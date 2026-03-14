
import requests
import os

url = "http://127.0.0.1:8000/sessions"
try:
    print(f"Testing GET {url}")
    resp = requests.get(url)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text}")
except Exception as e:
    print(f"Connection failed: {e}")

url_extract = "http://127.0.0.1:8000/extract"
test_file = r"c:\Users\Asus\Documents\OmniStruct-AI\backend\app_data.db" # Dummy file for testing 500
# Actually, let's use a real file if possible.
# I saw one in backend/uploads/
dummy_file = r"c:\Users\Asus\Documents\OmniStruct-AI\backend\uploads\efb889bd-9792-4a10-b625-db533304f8d7\AI.pdf"

try:
    print(f"\nTesting POST {url_extract}")
    with open(dummy_file, 'rb') as f:
        files = {'file': f}
        data = {'prompt': 'test', 'format': 'json'}
        resp = requests.post(url_extract, files=files, data=data)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text}")
except Exception as e:
    print(f"Extraction test failed: {e}")
