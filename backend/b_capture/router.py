"""A의 인증과 C의 분석 함수를 주입해 공통 FastAPI 앱에 연결할 수 있는 B 라우터."""
from hashlib import sha256
from typing import Callable, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Body, Depends, File, Form, UploadFile
from pydantic import BaseModel

from .images import CaptureError, MAX_UPLOAD_BYTES, normalize_image
from .storage import CaptureStore
from .pdf import validate_pdf


class CreateDocumentRequest(BaseModel):
    client_document_id: UUID | None = None


class DocumentCreated(BaseModel):
    id: int


class PageUploaded(BaseModel):
    document_id: int
    page_id: str
    page_number: int
    filename: str
    width: int
    height: int
    file_page_count: int = 1


class CaptureFinished(BaseModel):
    id: int
    status: Literal["queued"]
    page_count: int
    analysis_connected: bool


class DocumentStatus(BaseModel):
    id: int
    status: Literal["capturing", "processing", "completed", "failed"]
    step: Literal["ocr", "ai", "saving"] | None
    done: bool
    error: str | None


def create_capture_router(store: CaptureStore, *, require_owner: Callable,
                          analyze: Callable | None = None,
                          analysis_status: Callable | None = None,
                          include_status: bool = True) -> APIRouter:
    if require_owner is None:
        raise ValueError("로그인한 사용자 ID를 돌려주는 인증 함수를 연결해주세요.")
    if (analyze is None) != (analysis_status is None):
        raise ValueError("분석 실행 함수와 진행 상태 조회 함수를 함께 연결해주세요.")
    router = APIRouter(tags=["B 문서 촬영"])

    @router.post("/documents", status_code=201, response_model=DocumentCreated)
    def create_document(body: CreateDocumentRequest | None = Body(default=None),
                        owner_id: str = Depends(require_owner)):
        """새 촬영 문서를 만든다. 같은 client_document_id를 재전송하면 같은 번호를 반환한다."""
        request_key = str(body.client_document_id) if body and body.client_document_id else None
        return {"id": store.create_document(str(owner_id), request_key)}

    @router.post("/documents/{document_id}/pages", status_code=201, response_model=PageUploaded)
    def upload_page(document_id: int, file: UploadFile = File(...),
                    client_page_id: UUID | None = Form(default=None),
                    owner_id: str = Depends(require_owner)):
        """JPG/PNG 또는 PDF(10MB·100페이지 이하)를 검증해 저장한다. PDF의 width/height는 0이다."""
        store.document(document_id, str(owner_id))
        content = file.file.read(MAX_UPLOAD_BYTES + 1)
        is_pdf = content.startswith(b"%PDF-")
        file_page_count = validate_pdf(content) if is_pdf else 1
        if is_pdf:
            image, width, height = content, 0, 0
        else:
            image, width, height = normalize_image(content)
        page_id = str(client_page_id or uuid4())
        page = store.add_page(document_id, str(owner_id), page_id, sha256(content).hexdigest(), image, width, height, extension=".pdf" if is_pdf else ".jpg")
        return {**page, "page_id": page["id"], "file_page_count": file_page_count}

    def dispatch(document_id: int, paths):
        try:
            analyze(document_id, paths)
        except Exception:
            store.dispatch_failed(document_id)

    @router.post("/documents/{document_id}/finish", status_code=202, response_model=CaptureFinished)
    def finish_document(document_id: int, background_tasks: BackgroundTasks,
                        owner_id: str = Depends(require_owner)):
        """사진 추가를 마감하고 분석을 요청한다. C 연결 전에는 요청을 DB의 queued 상태로 보관한다."""
        count = store.finish(document_id, str(owner_id))
        if analyze is not None and store.claim_analysis(document_id):
            paths = store.page_paths(document_id, str(owner_id))
            background_tasks.add_task(dispatch, document_id, paths)
        return {"id": document_id, "status": "queued", "page_count": count,
                "analysis_connected": analyze is not None}

    if include_status:
        @router.get("/documents/{document_id}/status", response_model=DocumentStatus)
        def get_status(document_id: int, owner_id: str = Depends(require_owner)):
            """C와 같은 ocr/ai/saving 단계 형식. 분석 시작 대기 중에는 step이 null이다."""
            document = store.document(document_id, str(owner_id))
            if analysis_status is not None and document["status"] == "queued":
                try:
                    result = analysis_status(document_id)
                    if result["id"] != document_id:
                        raise CaptureError(502, "분석 상태의 문서 번호를 확인해주세요.")
                    return result
                except LookupError:
                    pass
            error = document["analysis_error"]
            status = "capturing" if document["status"] == "capturing" else "processing"
            if error:
                status = "failed"
            return {"id": document_id, "status": status, "step": None, "done": bool(error), "error": error}

    return router
