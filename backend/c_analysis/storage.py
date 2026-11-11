"""B의 문서·사진 테이블을 건드리지 않는 C 전용 분석 상태/결과 저장소."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager, closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class AnalysisNotFound(LookupError):
    pass


class AnalysisNotReady(RuntimeError):
    pass


_SCHEMA = """
CREATE TABLE IF NOT EXISTS c_document_analyses (
    document_id INTEGER PRIMARY KEY,
    status TEXT NOT NULL CHECK(status IN ('processing', 'completed', 'failed')),
    step TEXT CHECK(step IN ('ocr', 'ai', 'saving') OR step IS NULL),
    result_json TEXT,
    error TEXT,
    updated_at TEXT NOT NULL
);
"""


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class SQLiteAnalysisStore:
    """독립 테이블만 사용합니다. 데이터베이스 파일 경로는 팀 공통값을 받습니다."""

    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._db() as conn:
            conn.executescript(_SCHEMA)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout = 10000")
        return conn

    @contextmanager
    def _db(self):
        # sqlite3.Connection.__exit__은 커밋만 처리하므로 명시적으로 닫습니다.
        with closing(self._connect()) as conn:
            with conn:
                yield conn

    def start(self, document_id: int, *, retry_failed: bool = False) -> bool:
        """한 번만 시작합니다. 중복 finish 요청으로 분석이 겹치지 않게 합니다."""
        if document_id < 1:
            raise ValueError("문서 ID는 양수여야 합니다.")
        with self._db() as conn:
            cursor = conn.execute(
                "INSERT OR IGNORE INTO c_document_analyses (document_id, status, step, updated_at) "
                "VALUES (?, 'processing', 'ocr', ?)",
                (document_id, _utc_now()),
            )
            if cursor.rowcount > 0:
                return True
            if retry_failed:
                cursor = conn.execute(
                    "UPDATE c_document_analyses SET status = 'processing', step = 'ocr', "
                    "result_json = NULL, error = NULL, updated_at = ? "
                    "WHERE document_id = ? AND status = 'failed'",
                    (_utc_now(), document_id),
                )
                return cursor.rowcount > 0
        return False

    def update_step(self, document_id: int, step: str) -> None:
        if step not in ("ocr", "ai", "saving"):
            raise ValueError("지원하지 않는 분석 단계입니다.")
        with self._db() as conn:
            cursor = conn.execute(
                "UPDATE c_document_analyses SET step = ?, updated_at = ? "
                "WHERE document_id = ? AND status = 'processing'",
                (step, _utc_now(), document_id),
            )
            if cursor.rowcount != 1:
                raise AnalysisNotReady("진행 중인 분석을 찾지 못했어요.")

    def complete(self, document_id: int, result: dict[str, Any]) -> None:
        if result.get("id") != document_id or result.get("status") != "completed":
            raise ValueError("저장할 결과의 문서 ID 또는 완료 상태가 맞지 않습니다.")
        serialized = json.dumps(result, ensure_ascii=False, separators=(",", ":"))
        with self._db() as conn:
            cursor = conn.execute(
                "UPDATE c_document_analyses SET status = 'completed', step = NULL, "
                "result_json = ?, error = NULL, updated_at = ? "
                "WHERE document_id = ? AND status = 'processing'",
                (serialized, _utc_now(), document_id),
            )
            if cursor.rowcount != 1:
                raise AnalysisNotReady("완료할 분석을 찾지 못했어요.")

    def fail(self, document_id: int, message: str) -> None:
        with self._db() as conn:
            conn.execute(
                "UPDATE c_document_analyses SET status = 'failed', step = NULL, "
                "result_json = NULL, error = ?, updated_at = ? "
                "WHERE document_id = ? AND status = 'processing'",
                (message[:200], _utc_now(), document_id),
            )

    def status(self, document_id: int) -> dict[str, Any]:
        with self._db() as conn:
            row = conn.execute(
                "SELECT status, step, error FROM c_document_analyses WHERE document_id = ?",
                (document_id,),
            ).fetchone()
        if row is None:
            raise AnalysisNotFound("분석 내역을 찾지 못했어요.")
        return {
            "id": document_id,
            "status": row["status"],
            "step": row["step"],
            "done": row["status"] in ("completed", "failed"),
            "error": row["error"],
        }

    def result(self, document_id: int) -> dict[str, Any]:
        with self._db() as conn:
            row = conn.execute(
                "SELECT status, result_json FROM c_document_analyses WHERE document_id = ?",
                (document_id,),
            ).fetchone()
        if row is None:
            raise AnalysisNotFound("분석 내역을 찾지 못했어요.")
        if row["status"] != "completed" or not row["result_json"]:
            raise AnalysisNotReady("아직 결과를 볼 수 없어요.")
        return json.loads(row["result_json"])
