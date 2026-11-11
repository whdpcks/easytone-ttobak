from itertools import count

from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, UploadFile

app = FastAPI()
document_ids = count(1)
documents: dict[int, str] = {}


@app.post("/documents", status_code=201)
def create_document(): # 촬영을 시작할 때 문서 번호를 발급해주는 API
    document_id = next(document_ids)
    documents[document_id] = "capturing" # 문서 상태를 "capturing"으로 설정
    return {"id": document_id} # 문서 번호를 앱에 돌려줌 

UPLOAD_DIR = Path.home() / ".ttobak-b-dev" / "uploads"
MAX_FILE_SIZE = 10 * 1024 * 1024


@app.post("/documents/{document_id}/pages", status_code=201)
def upload_page(document_id: int, file: UploadFile): # 사용자가 촬영한 사진을 업로드하는 API
    if document_id not in documents: # 문서가 존재하지 않으면 404 에러를 반환
        raise HTTPException(status_code=404, detail="문서 번호를 찾을 수 없어요.")

    extensions = {"image/jpeg": ".jpg", "image/png": ".png"} # 업로드 요청이 들어온 파일이 JPG 또는 PNG인지 확인
    extension = extensions.get(file.content_type)
    if extension is None:
        raise HTTPException(status_code=415, detail="JPG 또는 PNG를 골라주세요.")

    photo = file.file.read(MAX_FILE_SIZE + 1) # 제한보다 큰 파일이 들어오면 400 에러를 반환
    if not photo or len(photo) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="10MB 이하의 사진을 골라주세요.")

    folder = UPLOAD_DIR / str(document_id)
    folder.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4().hex}{extension}" # 파일 이름을 랜덤하게 생성
    (folder / filename).write_bytes(photo)
    return {"document_id": document_id, "filename": filename}