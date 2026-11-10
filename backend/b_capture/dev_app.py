from itertools import count

from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, UploadFile

app = FastAPI()
document_ids = count(1)
documents: dict[int, str] = {}


@app.post("/documents", status_code=201)
def create_document():
    document_id = next(document_ids)
    documents[document_id] = "capturing"
    return {"id": document_id}

UPLOAD_DIR = Path.home() / ".ttobak-b-dev" / "uploads"
MAX_FILE_SIZE = 10 * 1024 * 1024


@app.post("/documents/{document_id}/pages", status_code=201)
def upload_page(document_id: int, file: UploadFile):
    if document_id not in documents:
        raise HTTPException(status_code=404, detail="문서 번호를 찾을 수 없어요.")

    extensions = {"image/jpeg": ".jpg", "image/png": ".png"}
    extension = extensions.get(file.content_type)
    if extension is None:
        raise HTTPException(status_code=415, detail="JPG 또는 PNG를 골라주세요.")

    photo = file.file.read(MAX_FILE_SIZE + 1)
    if not photo or len(photo) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="10MB 이하의 사진을 골라주세요.")

    folder = UPLOAD_DIR / str(document_id)
    folder.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4().hex}{extension}"
    (folder / filename).write_bytes(photo)
    return {"document_id": document_id, "filename": filename}