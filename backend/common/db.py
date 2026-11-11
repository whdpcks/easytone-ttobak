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

-- 문자 인증번호 (전화번호당 1개, 새로 받으면 덮어씀)
CREATE TABLE IF NOT EXISTS phone_codes (
    phone       TEXT    PRIMARY KEY,
    code_hash   TEXT    NOT NULL,
    expires_at  REAL    NOT NULL,
    attempts    INTEGER NOT NULL DEFAULT 0,
    sent_at     REAL    NOT NULL
);

-- 가족과 함께 보기
CREATE TABLE IF NOT EXISTS family_members (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relation    TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    phone       TEXT    NOT NULL,
    created_at  TEXT    NOT NULL
);
"""

DEMO_USER = {"name": "김순자", "phone": "01012345678", "language": "ko", "font_scale": 1.25}
DEMO_FAMILY = {"relation": "딸", "name": "김미영", "phone": "01098765432"}


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
    """테이블을 만들고, 시연용 사용자(체험하기 버튼)와 가족 1명을 넣습니다."""
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
            demo_id = conn.execute("SELECT id FROM users WHERE phone = ?", (DEMO_USER["phone"],)).fetchone()[0]
            has_family = conn.execute("SELECT 1 FROM family_members WHERE user_id = ?", (demo_id,)).fetchone()
            if not has_family:
                conn.execute(
                    "INSERT INTO family_members (user_id, relation, name, phone, created_at) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (demo_id, DEMO_FAMILY["relation"], DEMO_FAMILY["name"], DEMO_FAMILY["phone"], utc_now()),
                )
