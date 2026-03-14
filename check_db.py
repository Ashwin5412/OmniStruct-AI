
import sqlite3
import os

db_path = r"c:\Users\Asus\Documents\OmniStruct-AI\backend\app_data.db"
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(document_metadata)")
    columns = cursor.fetchall()
    print("Columns in document_metadata:")
    for col in columns:
        print(f" - {col[1]} ({col[2]})")
    
    cursor.execute("PRAGMA table_info(messages)")
    columns = cursor.fetchall()
    print("\nColumns in messages:")
    for col in columns:
        print(f" - {col[1]} ({col[2]})")
    conn.close()
