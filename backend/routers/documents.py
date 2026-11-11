"""
D 담당 — GET /documents?category=  (보관함 목록)
문서 한 건 조회(GET /documents/{id})와 진행 상태는 C의 라우터가 담당합니다.
"""
from fastapi import APIRouter
from database import completed_documents

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("")
def list_documents(category: str | None = None):
    """보관함 목록 — 분석 완료 문서만, 최신순, 카테고리 필터 선택"""
    docs = completed_documents()
    if category:
        docs = [d for d in docs if d["category"] == category]
    return docs
