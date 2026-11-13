"""
D 담당 — GET /documents?category=  (보관함 목록)
문서 한 건 조회(GET /documents/{id})와 진행 상태는 C의 라우터가 담당합니다.
"""
from fastapi import APIRouter, Depends
from common.auth import get_current_user
from database import completed_documents, with_cached_translations

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
