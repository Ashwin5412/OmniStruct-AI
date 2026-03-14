
import sys
import os

# Add the backend directory to the path
sys.path.append(r"c:\Users\Asus\Documents\OmniStruct-AI\backend")

try:
    from app.db.database import SessionLocal, DocumentMetadata
    db = SessionLocal()
    sessions = db.query(DocumentMetadata).all()
    print(f"Successfully queried {len(sessions)} sessions.")
    for s in sessions:
        print(f" - ID: {s.id}, UUID: {s.session_uuid}, Title: {s.title}")
    db.close()
except Exception as e:
    import traceback
    print("Failed to query database:")
    traceback.print_exc()
