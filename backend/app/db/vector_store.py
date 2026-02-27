from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
import chromadb

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
chroma_client = chromadb.PersistentClient(path="./chroma_db")
vector_store = Chroma(client=chroma_client, collection_name="app_documents", embedding_function=embeddings)

text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

def store_in_chroma(chunks_data, doc_id):
    docs = []
    for chunk in chunks_data:
        splits = text_splitter.split_text(chunk["content"])
        for split in splits:
            metadata = chunk["metadata"].copy()
            metadata["doc_id"] = str(doc_id)
            docs.append(Document(page_content=split, metadata=metadata))
    
    if docs:
        vector_store.add_documents(documents=docs)