"""
D 담당 — GET /documents?category=  (보관함 목록)
문서 한 건 조회(GET /documents/{id})와 진행 상태는 C의 라우터가 담당합니다.
"""
from fastapi import APIRouter, Depends
from common.auth import get_current_user
from database import completed_documents

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("")
def list_documents(category: str | None = None, user: dict = Depends(get_current_user)):
    """보관함 목록 — 내 문서 중 분석 완료된 것만, 최신순, 카테고리 필터 선택"""
    docs = completed_documents(user["id"])
    if category:
        docs = [d for d in docs if d["category"] == category]
    return docs
