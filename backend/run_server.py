import uvicorn
import sys
import os

# Add the app directory to the sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), "app"))

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
