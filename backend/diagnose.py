import os
import sys

# Ensure backend can find its modules
sys.path.append(os.getcwd())

from app.core.ingestion import IngestionEngine
from app.db.vector_store import store_in_chroma
from app.core.agent import generate_dataset

def test_pipeline():
    print("Testing Ingestion...")
    ingestor = IngestionEngine()
    test_file = "test_data.csv"
    if not os.path.exists(test_file):
        with open(test_file, "w") as f:
            f.write("Company,Revenue\nAlpha,100\nBeta,200")
            
    chunks = ingestor.process_file(test_file)
    print(f"Ingested {len(chunks)} chunks.")
    
    print("Testing Chroma storage...")
    store_in_chroma(chunks, doc_id=999)
    print("Stored in Chroma.")
    
    print("Testing Agent generation...")
    try:
        data, audit = generate_dataset("Extract companies and revenue")
        print(f"Success! Extracted: {data}")
    except Exception as e:
        print(f"FAILED during generation: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_pipeline()
