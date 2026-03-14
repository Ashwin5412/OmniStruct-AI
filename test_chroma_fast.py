import os
import chromadb

# Absolute path based on my discovery
BASE_DIR = r"c:\Users\Asus\Documents\OmniStruct-AI\backend"
CHROMA_PATH = os.path.join(BASE_DIR, "chroma_db")

def test_metadata():
    print(f"Checking Chroma DB at: {CHROMA_PATH}")
    
    if not os.path.exists(CHROMA_PATH):
        print("CHROMA_PATH does not exist!")
        return

    client = chromadb.PersistentClient(path=CHROMA_PATH)
    try:
        collection = client.get_collection("app_documents")
        count = collection.count()
        print(f"Total documents in collection: {count}")
        
        if count > 0:
            results = collection.get()
            uuids = set()
            for meta in results['metadatas']:
                uuids.add(str(meta.get('session_uuid')))
            print(f"Unique session_uuids found: {uuids}")
            
            # Show the most recent one if possible
            last_meta = results['metadatas'][-1]
            print(f"Latest Metadata: {last_meta}")
    except Exception as e:
        print(f"Error: {e}")
            
if __name__ == "__main__":
    test_metadata()
