"""팀 공통 SQLite 연결 (A 담당).

B·C·D 모두 같은 DB 파일을 씁니다. 경로는 환경변수 TTOBAK_DB_PATH로 바꿀 수 있고,
기본값은 backend 폴더 기준 data/ttobak.db 입니다. (C의 SQLiteAnalysisStore, D의 database.py와 같은 값)
"""
from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_DB_PATH = "data/ttobak.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    phone       TEXT    NOT NULL UNIQUE,
    language    TEXT    NOT NULL DEFAULT 'ko',
    font_scale  REAL    NOT NULL DEFAULT 1.0,
    voice_rate  REAL    NOT NULL DEFAULT 0.92,
    created_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_tokens (
    token       TEXT    PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT    NOT NULL
);
"""

DEMO_USER = {"name": "김순자", "phone": "01012345678", "language": "ko", "font_scale": 1.25}


def db_path() -> Path:
    return Path(os.getenv("TTOBAK_DB_PATH", DEFAULT_DB_PATH))


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def connect():
    """with connect() as conn: ... — 정상 종료 시 commit, 예외 시 rollback."""
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(seed_demo: bool | None = None) -> None:
    """테이블을 만들고, 시연용 사용자(간편 로그인)를 넣습니다."""
    if seed_demo is None:
        seed_demo = os.getenv("TTOBAK_SEED_DEMO", "1") == "1"
    with connect() as conn:
        conn.executescript(SCHEMA)
        if seed_demo:
            conn.execute(
                "INSERT OR IGNORE INTO users (name, phone, language, font_scale, created_at) "
                "VALUES (:name, :phone, :language, :font_scale, :created_at)",
                {**DEMO_USER, "created_at": utc_now()},
            )
