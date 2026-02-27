import fitz
import pandas as pd
from docx import Document
import os

class IngestionEngine:
    def __init__(self, upload_dir="uploads"):
        self.upload_dir = upload_dir
        if not os.path.exists(self.upload_dir):
            os.makedirs(self.upload_dir)

    def process_file(self, file_path):
        ext = os.path.splitext(file_path)[-1].lower()
        
        if ext == ".pdf":
            return self._parse_pdf(file_path)
        elif ext in [".xlsx", ".xls"]:
            return self._parse_excel(file_path)
        elif ext == ".csv":
            return self._parse_csv(file_path)
        elif ext == ".docx":
            return self._parse_docx(file_path)
        elif ext in [".png", ".jpg", ".jpeg"]:
            return self._parse_image(file_path)
        else:
            raise ValueError(f"Unsupported file format: {ext}")

    def _parse_pdf(self, file_path):
        doc = fitz.open(file_path)
        chunks = []
        for page_num, page in enumerate(doc):
            text = page.get_text("text")
            if text.strip():
                chunks.append({
                    "content": text,
                    "metadata": {"source": file_path, "page": page_num + 1, "format": "pdf"}
                })
        doc.close()
        return chunks

    def _parse_excel(self, file_path):
        xl = pd.ExcelFile(file_path)
        chunks = []
        for sheet_name in xl.sheet_names:
            df = xl.parse(sheet_name)
            if not df.empty:
                chunks.append({
                    "content": df.to_markdown(index=False),
                    "metadata": {"source": file_path, "sheet": sheet_name, "format": "excel"}
                })
        return chunks

    def _parse_csv(self, file_path):
        df = pd.read_csv(file_path)
        return [{
            "content": df.to_markdown(index=False),
            "metadata": {"source": file_path, "format": "csv"}
        }]

    def _parse_docx(self, file_path):
        doc = Document(file_path)
        full_text = [para.text for para in doc.paragraphs if para.text.strip()]
        return [{
            "content": "\n".join(full_text),
            "metadata": {"source": file_path, "format": "docx"}
        }]

    def _parse_image(self, file_path):
        return [{
            "content": f"IMAGE_REFERENCE: {file_path}",
            "metadata": {"source": file_path, "format": "image", "requires_vision": True}
        }]