"""Upstage Document Parse에 서버가 저장한 문서 사진을 전달합니다.

OCR은 B의 카메라/사진 저장 이후 실행됩니다. 외부 API로 보내는 파일은
사용자 입력 경로가 아니라 서버가 이미 저장·검증한 사진이어야 합니다.
"""

from __future__ import annotations

import json
import os
import time
import uuid
from pathlib import Path
from typing import Any, Callable, Iterable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DOCUMENT_PARSE_ENDPOINT = "https://api.upstage.ai/v1/document-digitization"
_ALLOWED_TYPES = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".bmp": "image/bmp",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".heic": "image/heic",
}


class DocumentReadError(RuntimeError):
    """문서가 없거나 OCR 서비스가 정상적인 글자를 주지 못했을 때."""


def text_from_parse_response(payload: dict[str, Any]) -> str:
    """Document Parse 응답의 텍스트/마크다운을 읽습니다.

    문서 표는 구조를 유지하는 Markdown을 우선 사용합니다.
    """
    content = payload.get("content")
    if isinstance(content, dict):
        for key in ("markdown", "text", "html"):
            value = content.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    elif isinstance(content, str) and content.strip():
        return content.strip()

    elements = payload.get("elements")
    if isinstance(elements, list):
        blocks = [item.get("text", "") for item in elements if isinstance(item, dict)]
        combined = "\n".join(part.strip() for part in blocks if isinstance(part, str) and part.strip())
        if combined:
            return combined

    raise DocumentReadError("사진에서 읽을 수 있는 글자를 찾지 못했어요. 다시 촬영해 주세요.")


def _multipart_form(path: Path, data: bytes, *, model: str, mode: str) -> tuple[bytes, str]:
    boundary = f"ttobak-{uuid.uuid4().hex}"
    mime = _ALLOWED_TYPES[path.suffix.lower()]
    safe_filename = "document" + path.suffix.lower()
    chunks = []

    for name, value in (("model", model), ("mode", mode), ("output_formats", "['markdown']")):
        chunks.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode()
        )
    chunks.extend(
        [
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"document\"; filename=\"{safe_filename}\"\r\nContent-Type: {mime}\r\n\r\n".encode(),
            data,
            f"\r\n--{boundary}--\r\n".encode(),
        ]
    )
    return b"".join(chunks), boundary


class UpstageDocumentParser:
    """문서 사진 1장씩 OCR합니다. 공식 Document Parse 동기 API를 사용합니다."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        endpoint: str = DOCUMENT_PARSE_ENDPOINT,
        model: str = "document-parse",
        mode: str = "auto",
        timeout_seconds: int = 90,
        max_image_bytes: int = 20 * 1024 * 1024,
        opener: Callable[..., Any] = urlopen,
    ) -> None:
        self.api_key = api_key if api_key is not None else os.environ.get("UPSTAGE_API_KEY")
        self.endpoint = endpoint
        self.model = model
        self.mode = mode
        self.timeout_seconds = timeout_seconds
        self.max_image_bytes = max_image_bytes
        self._opener = opener

    def parse_image(self, path: str | Path) -> str:
        image_path = Path(path)
        if image_path.suffix.lower() not in _ALLOWED_TYPES:
            raise DocumentReadError("지원하지 않는 사진 형식이에요. JPG, PNG 또는 PDF를 올려주세요.")
        if not image_path.is_file():
            raise DocumentReadError("저장된 사진을 찾을 수 없어요.")
        image_size = image_path.stat().st_size
        if image_size == 0 or image_size > self.max_image_bytes:
            raise DocumentReadError("사진 크기가 올바르지 않아요. 다시 촬영해 주세요.")
        if not self.api_key:
            raise DocumentReadError("문서 인식 서비스가 아직 연결되지 않았어요.")

        payload, boundary = _multipart_form(
            image_path, image_path.read_bytes(), model=self.model, mode=self.mode
        )
        request = Request(
            self.endpoint,
            data=payload,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "Accept": "application/json",
            },
            method="POST",
        )

        # 잠깐 발생하는 서버/요청 제한 오류만 한 번 더 시도합니다.
        for attempt in range(2):
            try:
                with self._opener(request, timeout=self.timeout_seconds) as response:
                    result = json.load(response)
                if not isinstance(result, dict):
                    raise DocumentReadError("문서 인식 결과를 읽을 수 없어요.")
                return text_from_parse_response(result)
            except HTTPError as exc:
                if exc.code in (429, 500, 502, 503, 504) and attempt == 0:
                    time.sleep(0.5)
                    continue
                raise DocumentReadError("문서 인식 서비스에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.") from exc
            except (URLError, TimeoutError, OSError, ValueError) as exc:
                raise DocumentReadError("문서 인식 결과를 가져오지 못했어요. 연결을 확인해 주세요.") from exc

        raise DocumentReadError("문서 인식에 실패했어요.")

    def parse_pages(self, image_paths: Iterable[str | Path]) -> str:
        paths = list(image_paths)
        if not paths:
            raise DocumentReadError("분석할 문서 사진이 없어요.")
        # 페이지 번호는 단순한 구분일 뿐, 근거 '원문 줄 번호'가 아닙니다.
        parts = [f"[페이지 {index}]\n{self.parse_image(path)}" for index, path in enumerate(paths, 1)]
        return "\n\n".join(parts)
