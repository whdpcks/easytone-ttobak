"""B API 단독 실행. 팀 앱에는 create_capture_router와 A의 인증 함수를 연결한다."""
import os
from pathlib import Path
import sys

from fastapi import FastAPI

# 기존 --app-dir backend/b_capture 실행 명령도 계속 지원한다.
if not __package__:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from b_capture.router import create_capture_router
from b_capture.storage import CaptureStore


def create_app(*, data_dir=None, db_path=None, require_owner=None, analyze=None, analysis_status=None):
    root = Path(data_dir or os.environ.get("TTOBAK_DATA_DIR", Path.home() / ".ttobak-b-dev"))
    database = Path(db_path or os.environ.get("TTOBAK_DB_PATH", root / "ttobak.db"))
    store = CaptureStore(database, root / "uploads")
    application = FastAPI(title="또박 B 촬영 API", version="1.0.0",
                          description="문서 생성, 사진 업로드와 보정, 촬영 종료 및 분석 요청")
    application.state.capture_store = store

    def local_owner():
        return 1

    application.include_router(create_capture_router(
        store, require_owner=require_owner or local_owner,
        analyze=analyze, analysis_status=analysis_status,
    ))
    return application


app = create_app()
