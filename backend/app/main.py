import json
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import shutil
import uuid
import os
import asyncio
from concurrent.futures import ThreadPoolExecutor
import pandas as pd
import numpy as np
import base64
import io
import tempfile
from app.db.database import SessionLocal, DocumentMetadata, Message, engine, Base
from app.core.ingestion import IngestionEngine
from app.db.vector_store import store_in_chroma
from app.core.agent import generate_dataset, get_filtered_rag_chain, generate_session_title

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)
ingestor = IngestionEngine()
executor = ThreadPoolExecutor(max_workers=5)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def process_and_store_single_file(file_path: str, session_uuid: str):
    data_chunks = ingestor.process_file(file_path)
    store_in_chroma(data_chunks, session_uuid)
    return len(data_chunks)

def cleanup_upload_dir(upload_dir: str):
    if os.path.exists(upload_dir):
        shutil.rmtree(upload_dir)

class DatasetRequest(BaseModel):
    prompt: str
    format: str

class ChatRequest(BaseModel):
    sessionId: int
    question: str

@app.get("/sessions")
async def list_sessions(db: Session = Depends(get_db)):
    # List all documents/sessions
    sessions = db.query(DocumentMetadata).order_by(DocumentMetadata.upload_time.desc()).all()
    
    # Manually serialize to avoid potential Issues with raw SQLAlchemy models
    result = []
    for s in sessions:
        result.append({
            "id": s.id,
            "session_uuid": s.session_uuid,
            "filename": s.filename,
            "title": s.title,
            "status": s.status,
            "upload_time": s.upload_time.isoformat() if s.upload_time else None
        })
    return result

@app.get("/sessions/{session_id}")
async def get_session(session_id: int, db: Session = Depends(get_db)):
    try:
        doc = db.query(DocumentMetadata).filter(DocumentMetadata.id == session_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Session not found")
        
        messages = db.query(Message).filter(Message.session_id == session_id).order_by(Message.timestamp.asc()).all()
        
        # Process messages for frontend
        processed_messages = []
        for m in messages:
            msg = {
                "role": m.role,
                "content": m.content,
            }
            if m.attachment_name:
                msg["attachment"] = {"name": m.attachment_name, "size": m.attachment_size}
            if m.format:
                msg["format"] = m.format
            
            if m.dataset_json:
                try:
                    ds_data = json.loads(m.dataset_json)
                    msg["dataset"] = {
                        "columns": pd.DataFrame(ds_data).columns.tolist() if ds_data else [],
                        "rows": ds_data,
                        "format": m.format,
                        "sessionId": m.session_id,
                        "references": json.loads(m.references_json) if m.references_json else []
                    }
                except Exception as de:
                    print(f"DEBUG: Dataset parsing error for message {m.id}: {de}")
                    msg["dataset"] = None
                    
            processed_messages.append(msg)

        return {
            "sessionId": doc.id,
            "sessionUuid": doc.session_uuid,
            "filename": doc.filename,
            "title": doc.title,
            "status": doc.status,
            "messages": processed_messages
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to get session: {str(e)}")

@app.delete("/sessions/{session_id}")
async def delete_session(session_id: int, db: Session = Depends(get_db)):
    # Delete metadata
    doc = db.query(DocumentMetadata).filter(DocumentMetadata.id == session_id).first()
    if doc:
        db.delete(doc)
    
    # Delete messages
    db.query(Message).filter(Message.session_id == session_id).delete()
    
    db.commit()
    return {"status": "success"}

@app.post("/extract")
async def extract_dataset(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...), 
    prompt: str = Form(...),
    format: str = Form(...),
    db: Session = Depends(get_db)
):
    allowed_extensions = {'.pdf', '.xlsx', '.xls', '.csv', '.docx', '.png', '.jpg', '.jpeg'}
    
    # Create a unique directory for this session's uploads
    session_id_dir = str(uuid.uuid4())
    upload_dir = os.path.join("uploads", session_id_dir)
    os.makedirs(upload_dir, exist_ok=True)
    
    session_uuid = str(uuid.uuid4())
    file_paths = []
    
    for file in files:
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in allowed_extensions:
            # Cleanup on failure
            background_tasks.add_task(cleanup_upload_dir, upload_dir)
            raise HTTPException(status_code=400, detail=f"Invalid file format: {file.filename}")

        file_path = os.path.join(upload_dir, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        abs_path = os.path.abspath(file_path)
        file_paths.append(abs_path)

    db_record = DocumentMetadata(
        session_uuid=session_uuid,
        filename=", ".join([f.filename for f in files]),
        file_path=os.path.abspath(upload_dir),
        status="processing"
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    
    # Store user message
    user_msg = Message(
        session_id=db_record.id,
        role="user",
        content=prompt,
        attachment_name=", ".join([f.filename for f in files]),
        attachment_size=f"{sum(os.path.getsize(p) for p in file_paths)} bytes",
        format=format
    )
    db.add(user_msg)
    db.commit()

    try:
        # Process each file into the same session vector store
        total_chunks = 0
        for path in file_paths:
            chunk_count = await asyncio.to_thread(process_and_store_single_file, path, db_record.session_uuid)
            total_chunks += chunk_count
            
        print(f"DEBUG: Stored {total_chunks} total chunks for session {db_record.session_uuid}")
        db_record.status = "completed"
    except Exception as e:
        db_record.status = "failed"
        db.commit()
        background_tasks.add_task(cleanup_upload_dir, upload_dir)
        raise HTTPException(status_code=500, detail=f"Failed to process files: {str(e)}")

    try:
        # Run blocking LLM dataset generation
        dataset_json, audit_trail = await asyncio.to_thread(generate_dataset, prompt, db_record.session_uuid)
        
        db_record.extracted_data = json.dumps(dataset_json)
        
        # Store AI response
        ai_msg = Message(
            session_id=db_record.id,
            role="ai",
            content=f"I've successfully extracted the dataset from {len(files)} uploaded documents.",
            dataset_json=json.dumps(dataset_json),
            references_json=json.dumps(audit_trail),
            format=format
        )
        db.add(ai_msg)
        
        # Generate session title
        try:
            session_title = generate_session_title(audit_trail, files[0].filename if files else "Multiple Files")
            db_record.title = session_title
        except Exception as te:
            print(f"DEBUG: Title generation failed: {te}")
            db_record.title = files[0].filename if files else "Untitled"
            
        db.commit()

        df = pd.DataFrame(dataset_json)
        columns = df.columns.tolist() if not df.empty else []
        
        background_tasks.add_task(cleanup_upload_dir, upload_dir)

        return {
            "sessionId": db_record.id,
            "title": db_record.title,
            "columns": columns,
            "rows": dataset_json,
            "summary": "Data successfully extracted from multiple documents.",
            "format": format,
            "references": audit_trail
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        error_msg = str(e)
        if "402" in error_msg or "Insufficient balance" in error_msg:
            raise HTTPException(status_code=402, detail="Extraction failed: Your AI provider (OpenRouter) account has an insufficient balance. Please top up your credits to continue.")
        raise HTTPException(status_code=500, detail=f"Extraction failed: {error_msg}")

@app.post("/chat")
async def chat_with_document(request: ChatRequest, db: Session = Depends(get_db)):
    try:
        record = db.query(DocumentMetadata).filter(DocumentMetadata.id == request.sessionId).first()
        if not record:
            raise HTTPException(status_code=404, detail="Session not found")

        # Inject the extracted dataset as context into the prompt
        dataset_context = record.extracted_data if record.extracted_data else "No dataset extracted yet."
        
        enhanced_prompt = f"""
        Here is the dataset that was extracted from the document:
        {dataset_context}
        
        User Question: {request.question}
        
        Use zero-shot reasoning to answer the question based on the dataset above AND the document context.
        """

        # Use the filtered RAG chain
        chain = get_filtered_rag_chain(record.session_uuid)
        response = chain.invoke({"input": enhanced_prompt})
        answer = response.get("answer", "I could not find an answer.")

        # Store user question (store original, not enhanced)
        user_msg = Message(session_id=request.sessionId, role="user", content=request.question)
        db.add(user_msg)
        
        # Store AI answer
        ai_msg = Message(session_id=request.sessionId, role="ai", content=answer)
        db.add(ai_msg)
        db.commit()
        
        return {"answer": answer}
    except Exception as e:
        return {"answer": f"Error processing question: {str(e)}"}

@app.post("/chat_upload")
async def chat_with_document_upload(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    sessionId: int = Form(...),
    question: str = Form(...),
    format: str = Form("json"),
    db: Session = Depends(get_db)
):
    try:
        record = db.query(DocumentMetadata).filter(DocumentMetadata.id == sessionId).first()
        if not record:
            raise HTTPException(status_code=404, detail="Session not found")
            
        allowed_extensions = {'.pdf', '.xlsx', '.xls', '.csv', '.docx', '.png', '.jpg', '.jpeg'}
        
        upload_dir = os.path.join("uploads", str(uuid.uuid4()))
        os.makedirs(upload_dir, exist_ok=True)
        
        file_paths = []
        for file in files:
            file_ext = os.path.splitext(file.filename)[1].lower()
            if file_ext not in allowed_extensions:
                background_tasks.add_task(cleanup_upload_dir, upload_dir)
                raise HTTPException(status_code=400, detail=f"Invalid file format: {file.filename}")

            file_path = os.path.join(upload_dir, file.filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            file_paths.append(os.path.abspath(file_path))

        # Process and store all files
        total_chunks = 0
        for path in file_paths:
            chunk_count = await asyncio.to_thread(process_and_store_single_file, path, record.session_uuid)
            total_chunks += chunk_count
        
        print(f"DEBUG: Stored {total_chunks} additional chunks for session {record.session_uuid}")

        background_tasks.add_task(cleanup_upload_dir, upload_dir)

        # Store user message
        user_msg = Message(
            session_id=sessionId, 
            role="user", 
            content=question, 
            attachment_name=", ".join([f.filename for f in files]), 
            attachment_size=f"{sum(os.path.getsize(p) for p in file_paths)} bytes"
        )
        db.add(user_msg)
        db.commit()

        # 1. Answer the user's specific conversational question
        dataset_context = record.extracted_data if record.extracted_data else "No dataset extracted yet."
        enhanced_prompt = f"""
        Here is the dataset that was extracted from the previous document(s):
        {dataset_context}
        
        User Question: {question}
        
        Use zero-shot reasoning to answer the question based on the dataset above AND the new document context. 
        IMPORTANT: If the user's question is an instruction to extract, add, or process new data from the document, simply reply with "I am extracting the requested data from the new document now." Do not try to answer it as a factual question in that case.
        """

        chain = get_filtered_rag_chain(record.session_uuid)
        response = chain.invoke({"input": enhanced_prompt})
        answer = response.get("answer", "I could not find an answer.")

        # 2. Try to Generate an updated combined dataset that merges the old context with the new one
        try:
             # Use the user's actual question as the extraction prompt so that the vector store
             # retrieves the correct semantic chunks from the newly uploaded document.
             extraction_prompt = question
             
             new_dataset_json, audit_trail = await asyncio.to_thread(generate_dataset, extraction_prompt, record.session_uuid)
             
             # if valid list generated, update the db
             if isinstance(new_dataset_json, list) and len(new_dataset_json) > 0 and 'error' not in new_dataset_json[0]:
                 # Try to merge with the old dataset if both are lists
                 if record.extracted_data:
                      try:
                          old_ds = json.loads(record.extracted_data)
                          if isinstance(old_ds, list):
                               new_dataset_json = old_ds + new_dataset_json # Append new rows
                      except:
                          pass

                 record.extracted_data = json.dumps(new_dataset_json)
                 df = pd.DataFrame(new_dataset_json)
                 new_dataset_obj = {
                    "columns": df.columns.tolist() if not df.empty else [],
                    "rows": new_dataset_json,
                    "format": format,
                    "sessionId": sessionId,
                    "references": audit_trail
                 }
             else:
                 new_dataset_obj = None
        except Exception as e:
             print(f"DEBUG: Failed secondary extraction on upload: {e}")
             new_dataset_obj = None

        # Store AI response
        ai_msg = Message(
            session_id=sessionId, 
            role="ai", 
            content=answer,
            dataset_json=json.dumps(new_dataset_json) if new_dataset_obj else None,
            format=format if new_dataset_obj else None
        )
        db.add(ai_msg)
        db.commit()

        return {"answer": answer, "dataset": new_dataset_obj}
    except Exception as e:
        return {"answer": f"Error processing question with upload: {str(e)}"}

@app.get("/download/{session_id}")
async def download_dataset(session_id: int, format: str = "json", db: Session = Depends(get_db)):
    record = db.query(DocumentMetadata).filter(DocumentMetadata.id == session_id).first()
    if not record or not record.extracted_data:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        data = json.loads(record.extracted_data)
        df = pd.DataFrame(data)

        if format == "csv":
            stream = io.StringIO()
            df.to_csv(stream, index=False)
            response = Response(content=stream.getvalue(), media_type="text/csv")
            response.headers["Content-Disposition"] = f"attachment; filename=dataset.csv"
            return response

        elif format == "tsv":
            stream = io.StringIO()
            df.to_csv(stream, index=False, sep='\t')
            response = Response(content=stream.getvalue(), media_type="text/tab-separated-values")
            response.headers["Content-Disposition"] = f"attachment; filename=dataset.tsv"
            return response
            
        elif format == "excel" or format == "xlsx":
            stream = io.BytesIO()
            with pd.ExcelWriter(stream, engine='openpyxl') as writer:
                df.to_excel(writer, index=False)
            response = Response(content=stream.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            response.headers["Content-Disposition"] = f"attachment; filename=dataset.xlsx"
            return response
            
        else: # default to JSON
            return Response(content=record.extracted_data, media_type="application/json")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating download: {str(e)}")