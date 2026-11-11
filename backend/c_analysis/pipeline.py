"""B의 finish 이후 호출되는 OCR → AI → 결과 저장 실행 흐름."""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, Iterable, Protocol

from .analysis import AnalysisError
from .ocr import DocumentReadError

# 저장소를 구현하는 PR보다 먼저 병합하더라도 이 모듈을 import할 수 있어야 합니다.
# 런타임에는 store의 메서드만 사용하고 구체 타입은 검사 단계에서만 참조합니다.
if TYPE_CHECKING:
    from .storage import SQLiteAnalysisStore


class PageParser(Protocol):
    def parse_pages(self, image_paths: Iterable[str | Path]) -> str: ...


class FieldsAnalyzer(Protocol):
    def analyze(self, source_text: str, *, document_id: int) -> dict: ...


def analyze_document(
    document_id: int,
    *,
    image_paths: Iterable[str | Path],
    parser: PageParser,
    analyzer: FieldsAnalyzer,
    store: SQLiteAnalysisStore,
    retry_failed: bool = False,
) -> bool:
    """중복 실행이면 False; 새 분석 또는 실패한 건의 재분석을 시도했다면 True.

    API 키 등 설정 오류도 사용자에게 안전한 상태 메시지로 남깁니다.
    B가 BackgroundTasks.add_task 등에 이 함수를 등록하면 됩니다.
    실패 재시도는 store.start만 먼저 호출하지 말고 이 함수를 retry_failed=True로 호출합니다.
    """
    if not store.start(document_id, retry_failed=retry_failed):
        return False

    try:
        store.update_step(document_id, "ocr")
        source = parser.parse_pages(image_paths)
        store.update_step(document_id, "ai")
        result = analyzer.analyze(source, document_id=document_id)
        store.update_step(document_id, "saving")
        store.complete(document_id, result)
    except (DocumentReadError, AnalysisError) as exc:
        store.fail(document_id, str(exc))
    except Exception:
        # 원문·API 키·스택트레이스를 화면에 공개하지 않습니다.
        store.fail(document_id, "문서를 분석하지 못했어요. 잠시 뒤 다시 시도해 주세요.")
    return True
