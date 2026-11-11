"""음성 합성 API (A 담당) — GET /tts?text=...&lang=ko&rate=0.92 → audio/mpeg

- Microsoft Edge 온라인 신경망 음성(edge-tts)을 씁니다. API 키·비용이 없지만 공식 상용 API는 아닙니다.
  실서비스로 갈 때는 같은 함수 자리에 네이버 클로바 보이스, Google Cloud TTS 등을 붙이면 됩니다.
- 같은 문장은 data/tts_cache 에 저장해 두고 바로 돌려줍니다. (안내 문구는 거의 고정이라 금방 빨라짐)
- 로그인 전 화면(시작·회원가입)에서도 읽어야 해서 인증은 받지 않고, 글자 수를 제한합니다.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from .db import db_path

log = logging.getLogger("ttobak.tts")
router = APIRouter(tags=["tts"])

MAX_CHARS = 300

# 언어별 목소리 (여성, 또렷한 목소리 위주)
VOICES = {
    "ko": "ko-KR-SunHiNeural",
    "en": "en-US-AvaNeural",
    "zh": "zh-CN-XiaoxiaoNeural",
    "ja": "ja-JP-NanamiNeural",
    "vi": "vi-VN-HoaiMyNeural",
    "th": "th-TH-PremwadeeNeural",
    "id": "id-ID-GadisNeural",
    "fil": "fil-PH-BlessicaNeural",
    "km": "km-KH-SreymomNeural",
    "my": "my-MM-NilarNeural",
    "hi": "hi-IN-SwaraNeural",
    "ne": "ne-NP-HemkalaNeural",
}

_locks: dict[str, asyncio.Lock] = {}


def cache_dir() -> Path:
    d = db_path().parent / "tts_cache"
    d.mkdir(parents=True, exist_ok=True)
    return d


def rate_str(rate: float) -> str:
    """0.92 → '-8%' (edge-tts 형식)"""
    pct = round((rate - 1.0) * 100)
    return f"{pct:+d}%"


async def synthesize(text: str, lang: str, rate: float) -> Path:
    import edge_tts  # 서버 시작을 가볍게: 쓸 때만 불러옴

    voice = VOICES.get(lang, VOICES["ko"])
    key = hashlib.sha1(f"{voice}|{rate_str(rate)}|{text}".encode()).hexdigest()
    path = cache_dir() / f"{key}.mp3"
    if path.exists() and path.stat().st_size > 0:
        return path

    lock = _locks.setdefault(key, asyncio.Lock())
    async with lock:
        if path.exists() and path.stat().st_size > 0:
            return path
        tmp = path.with_suffix(".part")
        await edge_tts.Communicate(text, voice, rate=rate_str(rate)).save(str(tmp))
        tmp.replace(path)
    _locks.pop(key, None)
    return path


@router.get("/tts")
async def tts(
    text: str = Query(min_length=1, max_length=MAX_CHARS),
    lang: str = "ko",
    rate: float = Query(default=0.92, ge=0.5, le=1.5),
):
    text = " ".join(text.split())
    try:
        path = await asyncio.wait_for(synthesize(text, lang, rate), timeout=12)
    except Exception as exc:  # 네트워크 문제 등 → 앱은 브라우저 내장 음성으로 대신 읽음
        log.warning("TTS 실패: %s", exc)
        raise HTTPException(503, "음성을 만들지 못했어요.") from exc
    return FileResponse(path, media_type="audio/mpeg", headers={"Cache-Control": "public, max-age=604800"})
