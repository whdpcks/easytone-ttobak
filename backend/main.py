"""
또박 FastAPI 앱 — 팀 공통 진입점 (A 담당)

실행 (backend 폴더에서):
    uvicorn main:app --reload --port 8000

각 담당 라우터는 아래 "라우터 연결" 구역에서 붙입니다.
아직 main에 들어오지 않은 모듈은 import에 실패해도 앱이 뜨도록 건너뜁니다.
"""
import logging
import os

from dotenv import load_dotenv
from pathlib import Path
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from common import auth, tts
from common.db import db_path, init_db

load_dotenv()
log = logging.getLogger("ttobak")

app = FastAPI(title="또박 API", version="0.1.0")

# 프론트 주소(Vercel 등)를 쉼표로 구분해 넣습니다. 비어 있으면 개발용으로 전부 허용.
_origins = [o.strip() for o in os.getenv("TTOBAK_CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins or ["*"],
    allow_credentials=False,  # 쿠키 대신 Bearer 토큰을 쓰므로 필요 없음
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()
    log.info("DB ready: %s", db_path())


@app.get("/health")
def health():
    return {"status": "ok"}


# ── 라우터 연결 ────────────────────────────────────────────

# A: 로그인 · 회원가입 · 내 정보 · 가족, 음성 합성
app.include_router(auth.router)
app.include_router(tts.router)

# B: 공통 DB와 A의 Bearer 인증으로 촬영 문서를 저장한다.
from b_capture.router import create_capture_router
from b_capture.storage import CaptureStore


def capture_owner(user: dict = Depends(auth.get_current_user)) -> str:
    return str(user["id"])


capture_store = CaptureStore(db_path(), Path(os.getenv("TTOBAK_DATA_DIR", "data")) / "uploads")
app.state.capture_store = capture_store


# C: 분석 상태·결과 — 소유권 검사(require_document_owner)를 붙여서만 연결
try:
    from c_analysis.router import create_analysis_router
    from c_analysis.storage import SQLiteAnalysisStore

    app.include_router(
        create_analysis_router(
            SQLiteAnalysisStore(db_path()),
            authorize_document_dependency=auth.require_document_owner,
        )
    )
except ImportError:
    log.info("c_analysis 모듈이 아직 없어 분석 라우터를 건너뜁니다.")

# C가 자체 상태 조회를 제공하면 같은 경로를 중복 등록하지 않는다.
_has_analysis_status = any(getattr(route, "path", None) == "/documents/{document_id}/status" for route in app.routes)
app.include_router(create_capture_router(
    capture_store, require_owner=capture_owner, include_status=not _has_analysis_status,
))

# D: 보관함 목록 · AI 검색
try:
    from routers import documents, search

    app.include_router(documents.router)
    app.include_router(search.router)
except ImportError:
    log.info("D 라우터가 아직 없어 건너뜁니다.")
