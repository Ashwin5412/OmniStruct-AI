from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
import traceback # Add this at the top of your except block
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
        
        if request.format == "json":
            return {"data": dataset_json, "audit_trail": audit_trail}
            
        elif request.format == "csv":
            df = pd.DataFrame(dataset_json)
            csv_string = df.to_csv(index=False)
            return {"data": csv_string, "format": "csv", "audit_trail": audit_trail}
            
        elif request.format == "excel":
            return {"data": dataset_json, "format": "excel_ready", "audit_trail": audit_trail}
            
        else:
            raise HTTPException(status_code=400, detail="Unsupported format requested.")


    except Exception as e:
        traceback.print_exc() # This prints the giant red error log to your terminal!
        raise HTTPException(status_code=500, detail=str(e))