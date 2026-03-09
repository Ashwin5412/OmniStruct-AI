import sqlite3
import os

db_path = os.path.join(os.getcwd(), 'app', 'app_data.db')
print(f"Checking database at: {db_path}")

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if column exists
    cursor.execute("PRAGMA table_info(document_metadata)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if 'extracted_data' not in columns:
        print("Column 'extracted_data' missing. Adding it...")
        cursor.execute("ALTER TABLE document_metadata ADD COLUMN extracted_data TEXT")
        conn.commit()
        print("Column added successfully.")
    else:
        print("Column 'extracted_data' already exists.")
    
    conn.close()
else:
    print("Database file not found at the expected path.")
