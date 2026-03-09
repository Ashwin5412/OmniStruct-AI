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
from app.db.database import SessionLocal, DocumentMetadata, engine, Base
from app.core.ingestion import IngestionEngine
from app.db.vector_store import store_in_chroma
from app.core.agent import generate_dataset, rag_chain

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

def process_and_store_single_file(file_path: str, db_record_id: int):
    data_chunks = ingestor.process_file(file_path)
    store_in_chroma(data_chunks, db_record_id)
    return len(data_chunks)

class DatasetRequest(BaseModel):
    prompt: str
    format: str

class ChatRequest(BaseModel):
    sessionId: int
    question: str

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

    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join("uploads", unique_filename)
    os.makedirs("uploads", exist_ok=True)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    db_record = DocumentMetadata(
        filename=file.filename,
        file_path=file_path,
        status="processing"
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    
    # Process file and store in Chroma
    try:
        process_and_store_single_file(file_path, db_record.id)
        db_record.status = "completed"
    except Exception as e:
        db_record.status = "failed"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")

    # Generate dataset using the agent
    try:
        # Pass the specific document ID if your agent supports filtering, 
        # or we just rely on the general knowledge base as the original code did.
        dataset_json, audit_trail = generate_dataset(prompt)
        
        # Save extracted dataset to database for later downloads
        db_record.extracted_data = json.dumps(dataset_json)
        db.commit()

        # Format output for frontend
        df = pd.DataFrame(dataset_json)
        columns = df.columns.tolist() if not df.empty else []
        rows = dataset_json
        
        return {
            "sessionId": db_record.id,
            "columns": columns,
            "rows": rows,
            "summary": "Data successfully extracted from the document.",
            "format": format
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

@app.post("/chat")
async def chat_with_document(request: ChatRequest, db: Session = Depends(get_db)):
    try:
        # Ensure the document exists
        record = db.query(DocumentMetadata).filter(DocumentMetadata.id == request.sessionId).first()
        if not record:
            raise HTTPException(status_code=404, detail="Session not found")

        # Use the agent's rag_chain to answer the question
        response = rag_chain.invoke({"input": request.question})
        answer = response.get("answer", "I could not find an answer.")
        
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