from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
import shutil
import uuid
import os
from db.database import SessionLocal, DocumentMetadata, engine, Base
from core.ingestion import IngestionEngine
from db.vector_store import store_in_chroma

app = FastAPI()
Base.metadata.create_all(bind=engine)
ingestor = IngestionEngine()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/upload")
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    allowed_extensions = {'.pdf', '.xlsx', '.xls', '.csv', '.docx', '.png', '.jpg', '.jpeg'}
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Invalid file format")

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

    try:
        data_chunks = ingestor.process_file(file_path)
        
        store_in_chroma(data_chunks, db_record.id)
        
        db_record.status = "completed"
        db.commit()
        
        return {
            "id": db_record.id,
            "filename": db_record.filename,
            "chunks_processed": len(data_chunks),
            "status": "success",
            "vector_store": "updated"
        }
    except Exception as e:
        db_record.status = "failed"
        db.commit()
        raise HTTPException(status_code=500, detail=str(e))