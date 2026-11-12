"""A의 공통 앱과 B의 촬영 완료 콜백을 C의 분석 파이프라인에 연결합니다."""

from __future__ import annotations

from pathlib import Path
from typing import Callable, Iterable

from .analysis import SolarDocumentAnalyzer
from .ocr import UpstageDocumentParser
from .pipeline import analyze_document
from .storage import SQLiteAnalysisStore


def create_capture_analysis_handler(
    store: SQLiteAnalysisStore,
    *,
    parser_factory: Callable = UpstageDocumentParser,
    analyzer_factory: Callable = SolarDocumentAnalyzer,
) -> Callable[[int, Iterable[str | Path]], bool]:
    """B의 `analyze(document_id, image_paths)` 인터페이스를 제공합니다.

    B는 분석 실행권을 획득한 후에만 콜백을 호출하므로 C도 해당 실행권을
    신뢰해 중단된 이전 실행을 새 세대로 재시작할 수 있습니다.
    """

    def analyze(document_id: int, image_paths: Iterable[str | Path]) -> bool:
        return analyze_document(
            document_id,
            image_paths=image_paths,
            parser=parser_factory(),
            analyzer=analyzer_factory(),
            store=store,
            capture_dispatch_claimed=True,
        )

    return analyze
