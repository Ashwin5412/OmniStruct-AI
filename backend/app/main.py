from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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
from db.database import SessionLocal, DocumentMetadata, engine, Base
from core.ingestion import IngestionEngine
from db.vector_store import store_in_chroma
from core.agent import generate_dataset

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
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

@app.post("/upload")
async def upload_documents(files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
    allowed_extensions = {'.pdf', '.xlsx', '.xls', '.csv', '.docx', '.png', '.jpg', '.jpeg'}
    tasks = []
    db_records = []

    for file in files:
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in allowed_extensions:
            raise HTTPException(status_code=400, detail=f"Invalid file format: {file.filename}")

        unique_filename = f"{uuid.uuid4()}_{file.filename}"
        file_path = os.path.join("uploads", unique_filename)

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
        db_records.append(db_record)

    loop = asyncio.get_event_loop()
    
    for record in db_records:
        task = loop.run_in_executor(
            executor, 
            process_and_store_single_file, 
            record.file_path, 
            record.id
        )
        tasks.append(task)

    results = await asyncio.gather(*tasks, return_exceptions=True)

    response_data = []
    for record, result in zip(db_records, results):
        if isinstance(result, Exception):
            record.status = "failed"
            response_data.append({"filename": record.filename, "status": "failed", "error": str(result)})
        else:
            record.status = "completed"
            response_data.append({"filename": record.filename, "status": "success", "chunks": result})
    
    db.commit()
    return {"batch_status": "processed", "details": response_data}

@app.post("/generate-dataset")
async def create_dataset(request: DatasetRequest):
    try:
        dataset_json, audit_trail = generate_dataset(request.prompt)
        df = pd.DataFrame(dataset_json)
        
        response_data = {
            "json_data": dataset_json,
            "audit_trail": audit_trail,
            "format": request.format,
            "file_data": None
        }

        if request.format == "csv":
            response_data["file_data"] = df.to_csv(index=False)
            
        elif request.format == "xml":
            response_data["file_data"] = df.to_xml(index=False)
            
        elif request.format == "npy":
            npy_buffer = io.BytesIO()
            np.save(npy_buffer, df.to_numpy())
            response_data["file_data"] = base64.b64encode(npy_buffer.getvalue()).decode('utf-8')
            
        elif request.format == "h5":
            with tempfile.NamedTemporaryFile(suffix=".h5", delete=False) as tmp:
                temp_path = tmp.name
            df.to_hdf(temp_path, key='data', mode='w')
            with open(temp_path, "rb") as f:
                response_data["file_data"] = base64.b64encode(f.read()).decode('utf-8')
            os.remove(temp_path)

        return response_data

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))