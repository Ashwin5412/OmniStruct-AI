import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.app.db.vector_store import vector_store
import chromadb

def test_retrieval():
    # Use the absolute path defined in vector_store.py
    from backend.app.db.vector_store import CHROMA_PATH
    print(f"Checking Chroma DB at: {CHROMA_PATH}")
    
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    collection = client.get_collection("app_documents")
    
    count = collection.count()
    print(f"Total documents in collection: {count}")
    
    if count > 0:
        results = collection.get(limit=5)
        print("Sample Metadata:")
        for i, meta in enumerate(results['metadatas']):
            print(f"  Doc {i}: {meta}")
            
if __name__ == "__main__":
    test_retrieval()
