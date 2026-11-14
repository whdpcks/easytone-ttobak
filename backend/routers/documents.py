"""
D 담당 — GET /documents?category=  (보관함 목록)
         DELETE /documents/{id}     (문서 삭제)
         GET /documents/{id}/pages  (원문 보기 — 찍거나 올린 원본 목록)
         GET /documents/{id}/pages/{page_id}/file  (원본 파일: 사진 JPG 또는 올린 PDF 그대로)
문서 한 건 조회(GET /documents/{id})와 진행 상태는 C의 라우터가 담당합니다.
"""
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import FileResponse
from common.auth import get_current_user, require_document_owner
from database import completed_documents, delete_document, document_pages, page_file, with_cached_translations

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("")
def list_documents(category: str | None = None, lang: str | None = None,
                   user: dict = Depends(get_current_user)):
    """보관함 목록 — 내 문서 중 분석 완료된 것만, 최신순, 카테고리 필터 선택.
    lang을 주면 C가 번역해 둔 문서는 번역본("lang" 표시)으로 돌려줍니다. category는 번역해도 한국어 키 그대로."""
    docs = completed_documents(user["id"])
    if category:
        docs = [d for d in docs if d["category"] == category]
    return with_cached_translations(docs, lang)


@router.delete("/{document_id}", status_code=204)
def remove_document(document_id: int, user: dict = Depends(require_document_owner)):
    """문서 삭제 — 내 문서만 (남의 문서·없는 문서는 A의 검사에서 404). 지우면 되돌릴 수 없음."""
    delete_document(document_id)
    return Response(status_code=204)


@router.get("/{document_id}/pages")
def list_pages(document_id: int, user: dict = Depends(require_document_owner)):
    """원문 보기 — 이 문서에 찍거나 올린 원본 목록 (순서대로). 시연 샘플처럼 원본이 없으면 [].
    kind: 'image'(카메라 스캔·올린 사진, JPG) | 'pdf'(올린 PDF 원본 그대로)"""
    return document_pages(document_id)


@router.get("/{document_id}/pages/{page_id}/file")
def get_page_file(document_id: int, page_id: str, user: dict = Depends(require_document_owner)):
    """원본 파일 한 개. 내 문서의 페이지만 (남의 문서·없는 페이지는 404)."""
    found = page_file(document_id, page_id)
    if not found:
        raise HTTPException(404, "원본을 찾을 수 없어요.")
    path, media_type = found
    return FileResponse(path, media_type=media_type, headers={"Cache-Control": "private, max-age=86400"})
