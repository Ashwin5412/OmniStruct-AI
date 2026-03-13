import json
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException
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
from app.core.agent import generate_dataset, get_filtered_rag_chain

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
    return sessions

@app.get("/sessions/{session_id}")
async def get_session(session_id: int, db: Session = Depends(get_db)):
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
            msg["dataset"] = {
                "columns": pd.DataFrame(json.loads(m.dataset_json)).columns.tolist() if json.loads(m.dataset_json) else [],
                "rows": json.loads(m.dataset_json),
                "format": m.format,
                "sessionId": m.session_id,
                "references": json.loads(m.references_json) if m.references_json else []
            }
        processed_messages.append(msg)

    return {
        "sessionId": doc.id,
        "sessionUuid": doc.session_uuid,
        "filename": doc.filename,
        "status": doc.status,
        "messages": processed_messages
    }

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
    file: UploadFile = File(...), 
    prompt: str = Form(...),
    format: str = Form(...),
    db: Session = Depends(get_db)
):
    allowed_extensions = {'.pdf', '.xlsx', '.xls', '.csv', '.docx', '.png', '.jpg', '.jpeg'}
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Invalid file format: {file.filename}")

    # Create a unique directory to keep the original filename
    session_id_dir = str(uuid.uuid4())
    upload_dir = os.path.join("uploads", session_id_dir)
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    session_uuid = str(uuid.uuid4())
    db_record = DocumentMetadata(
        session_uuid=session_uuid,
        filename=file.filename,
        file_path=file_path,
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
        attachment_name=file.filename,
        attachment_size=f"{os.path.getsize(file_path)} bytes",
        format=format
    )
    db.add(user_msg)
    db.commit()

    try:
        process_and_store_single_file(file_path, db_record.session_uuid)
        db_record.status = "completed"
    except Exception as e:
        db_record.status = "failed"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")

    try:
        dataset_json, audit_trail = generate_dataset(prompt, db_record.session_uuid)
        
        db_record.extracted_data = json.dumps(dataset_json)
        
        # Store AI response
        ai_msg = Message(
            session_id=db_record.id,
            role="ai",
            content=f"I've successfully extracted the dataset from {file.filename}.",
            dataset_json=json.dumps(dataset_json),
            references_json=json.dumps(audit_trail),
            format=format
        )
        db.add(ai_msg)
        db.commit()

        df = pd.DataFrame(dataset_json)
        columns = df.columns.tolist() if not df.empty else []
        
        return {
            "sessionId": db_record.id,
            "columns": columns,
            "rows": dataset_json,
            "summary": "Data successfully extracted from the document.",
            "format": format,
            "references": audit_trail
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

@app.post("/chat")
async def chat_with_document(request: ChatRequest, db: Session = Depends(get_db)):
    try:
        record = db.query(DocumentMetadata).filter(DocumentMetadata.id == request.sessionId).first()
        if not record:
            raise HTTPException(status_code=404, detail="Session not found")

        # Use the filtered RAG chain
        chain = get_filtered_rag_chain(record.session_uuid)
        response = chain.invoke({"input": request.question})
        answer = response.get("answer", "I could not find an answer.")
        
        # Store user question
        user_msg = Message(session_id=request.sessionId, role="user", content=request.question)
        db.add(user_msg)
        
        # Store AI answer
        ai_msg = Message(session_id=request.sessionId, role="ai", content=answer)
        db.add(ai_msg)
        db.commit()
        
        return {"answer": answer}
    except Exception as e:
        return {"answer": f"Error processing question: {str(e)}"}

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