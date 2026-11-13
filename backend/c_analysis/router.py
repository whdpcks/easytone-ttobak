"""A의 FastAPI 앱에 연결하는 C 조회/번역 라우터."""
from __future__ import annotations

from typing import Callable, Literal
from .storage import AnalysisNotFound, AnalysisNotReady, SQLiteAnalysisStore
from .translation import SolarDocumentTranslator, TranslationError, translate_document

Language = Literal["ko", "en", "zh", "ja", "vi", "th", "id", "fil", "km", "my", "hi", "ne"]


def create_analysis_router(
    store: SQLiteAnalysisStore, *,
    authorize_document_dependency,
    include_status: bool = False,
    translator_factory: Callable[[], SolarDocumentTranslator] = SolarDocumentTranslator,
):
    from fastapi import APIRouter, Depends, HTTPException

    if authorize_document_dependency is None:
        raise ValueError("문서별 소유권을 검사하는 인증 함수를 반드시 전달해야 합니다.")
    router = APIRouter(tags=["document-analysis"], dependencies=[Depends(authorize_document_dependency)])

    if include_status:
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

    @router.get("/documents/{document_id}/translation")
    def get_translated_document(document_id: int, lang: Language = "ko"):
        """원본 GET은 그대로 두고, 사용자가 볼 때 선택 언어로 번역한다."""
        try:
            original = store.result(document_id)
            if lang == "ko":
                return original
            cached = store.get_translation(document_id, lang, original)
            if cached is not None:
                return cached
            translated = translate_document(original, lang=lang, translator=translator_factory())
            store.save_translation(document_id, lang, original, translated)
            return translated
        except AnalysisNotFound as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except AnalysisNotReady as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except TranslationError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    return router
