import os
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
import chromadb
from chromadb.config import Settings
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(env_path)

# Consistent absolute path for the database file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, "app_data.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"
load_dotenv()

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

chroma_client = chromadb.PersistentClient(path="./chroma_db")

class DocumentMetadata(Base):
    __tablename__ = "document_metadata"

    id = Column(Integer, primary_key=True, index=True)
    session_uuid = Column(String, unique=True, index=True)
    filename = Column(String)
    title = Column(String, nullable=True)
    file_path = Column(String)
    status = Column(String, default="pending")
    upload_time = Column(DateTime, default=datetime.utcnow)
    extracted_data = Column(Text, nullable=True)

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, index=True)
    role = Column(String) # user or ai
    content = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
    # Extra fields for specialized messages
    attachment_name = Column(String, nullable=True)
    attachment_size = Column(String, nullable=True)
    format = Column(String, nullable=True)
    dataset_json = Column(Text, nullable=True)
    references_json = Column(Text, nullable=True)
Base.metadata.create_all(bind=engine)