"""A의 FastAPI 앱에 명시적으로 연결할 C 전용 조회 라우터.

실제 연결은 A가 app.include_router(...)를 수행할 때만 일어납니다.
"""

from __future__ import annotations

from .storage import AnalysisNotFound, AnalysisNotReady, SQLiteAnalysisStore


def create_analysis_router(store: SQLiteAnalysisStore, *, authorize_document_dependency):
    # FastAPI 자체와 A의 앱 초기화는 C 모듈에서 건드리지 않습니다.
    from fastapi import APIRouter, Depends, HTTPException

    if authorize_document_dependency is None:
        raise ValueError("문서별 소유권을 검사하는 인증 함수를 반드시 전달해야 합니다.")
    router = APIRouter(tags=["document-analysis"], dependencies=[Depends(authorize_document_dependency)])

    @router.get("/documents/{document_id}/status")
    def get_document_status(document_id: int):
        try:
            return store.status(document_id)
        except AnalysisNotFound as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @router.get("/documents/{document_id}")
    def get_document_analysis(document_id: int):
        try:
            return store.result(document_id)
        except AnalysisNotFound as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except AnalysisNotReady as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    return router
