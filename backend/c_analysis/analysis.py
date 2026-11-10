"""OCR 원문을 쉬운 한국어의 구조화된 결과로 바꾸는 C 전용 분석기."""

from __future__ import annotations

import json
import os
import re
from datetime import date, datetime
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


CHAT_ENDPOINT = "https://api.upstage.ai/v1/chat/completions"
class AnalysisError(RuntimeError):
    """LLM 응답 오류 또는 복구할 수 없는 분석 데이터 오류."""


class SolarDocumentAnalyzer:
    """Solar 구조화 출력을 요청합니다. API 키가 없으면 외부 호출을 하지 않습니다."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str = "solar-pro4",
        endpoint: str = CHAT_ENDPOINT,
        timeout_seconds: int = 120,
        opener: Callable[..., Any] = urlopen,
    ) -> None:
        self.api_key = api_key if api_key is not None else os.environ.get("UPSTAGE_API_KEY")
        self.model = model
        self.endpoint = endpoint
        self.timeout_seconds = timeout_seconds
        self._opener = opener

