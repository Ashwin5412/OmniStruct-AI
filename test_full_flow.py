import sys
import os
import uuid
import json

# Setup paths
BASE_DIR = r"c:\Users\Asus\Documents\OmniStruct-AI"
sys.path.append(os.path.join(BASE_DIR, 'backend'))

from backend.app.core.agent import generate_dataset
from backend.app.main import process_and_store_single_file

def test_extraction_flow():
    # Use an existing file for testing
    test_file = os.path.join(BASE_DIR, "backend", "uploads", "125cfa5e-8370-4372-974c-afcf63288bab_test_data.csv")
    if not os.path.exists(test_file):
        print(f"Test file not found: {test_file}")
        return

    session_uuid = str(uuid.uuid4())
    print(f"Test Session UUID: {session_uuid}")
    
    print("\n--- Phase 1: Ingestion ---")
    chunk_count = process_and_store_single_file(test_file, session_uuid)
    print(f"Stored {chunk_count} chunks in Chroma.")
    
    print("\n--- Phase 2: Retrieval & Extraction ---")
    prompt = "Extract all data from this file"
    dataset, audit = generate_dataset(prompt, session_uuid)
    
    print(f"\nExtracted {len(dataset)} rows.")
    if dataset:
        print("First row:", dataset[0])
    else:
        print("Dataset is EMPTY!")

if __name__ == "__main__":
    test_extraction_flow()
