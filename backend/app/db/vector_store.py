from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
import chromadb

import chromadb
import os

# Consistent absolute path for the embedding database
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CHROMA_PATH = os.path.join(BASE_DIR, "chroma_db")

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
vector_store = Chroma(client=chroma_client, collection_name="app_documents", embedding_function=embeddings)

text_splitter = RecursiveCharacterTextSplitter(chunk_size=4000, chunk_overlap=1000)

def store_in_chroma(chunks_data, session_uuid):
    docs = []
    for chunk in chunks_data:
        splits = text_splitter.split_text(chunk["content"])
        for split in splits:
            metadata = chunk["metadata"].copy()
            metadata["session_uuid"] = str(session_uuid)
            docs.append(Document(page_content=split, metadata=metadata))
    
    if docs:
        vector_store.add_documents(documents=docs)