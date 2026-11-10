"""또박 C 담당의 독립 AI 분석 모듈.

A의 FastAPI 앱이나 B의 업로드 코드를 직접 수정하지 않습니다.
"""

from .ocr import DocumentReadError, UpstageDocumentParser

__all__ = ["DocumentReadError", "UpstageDocumentParser"]
