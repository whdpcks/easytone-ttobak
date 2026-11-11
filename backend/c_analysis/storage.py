"""B의 문서·사진 테이블을 건드리지 않는 C 전용 분석 상태/결과 저장소."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager, closing
from datetime import datetime, timedelta, timezone
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
    attempt INTEGER NOT NULL DEFAULT 1,
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
            # 기존 C DB를 유지하면서 실행 세대 번호만 추가합니다.
            columns = {row[1] for row in conn.execute("PRAGMA table_info(c_document_analyses)")}
            if "attempt" not in columns:
                conn.execute("ALTER TABLE c_document_analyses ADD COLUMN attempt INTEGER NOT NULL DEFAULT 1")

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

    def start(
        self,
        document_id: int,
        *,
        retry_failed: bool = False,
        retry_processing_after_seconds: int | None = None,
        capture_dispatch_claimed: bool = False,
    ) -> int | None:
        """실행 세대를 획득합니다. 중복 호출은 None을 반환합니다.

        B가 claim_analysis로 실행권을 확보했다면 진행 중인 분석도 새 세대로 시작합니다.
        단독 실행 시에는 선택적으로 C의 갱신 시간으로 재시도할 수 있습니다.
        기존 실행이 늦게 끝나더라도 세대 번호로 결과 덮어쓰기를 차단합니다.
        """
        if document_id < 1:
            raise ValueError("문서 ID는 양수여야 합니다.")
        if retry_processing_after_seconds is not None and retry_processing_after_seconds <= 0:
            raise ValueError("재시도 대기 시간은 양수여야 합니다.")
        now = datetime.now(timezone.utc)
        now_text = now.isoformat()
        with self._db() as conn:
            cursor = conn.execute(
                "INSERT OR IGNORE INTO c_document_analyses (document_id, status, step, updated_at) "
                "VALUES (?, 'processing', 'ocr', ?)",
                (document_id, now_text),
            )
            if cursor.rowcount > 0:
                return 1
            conditions = []
            condition_args: list[Any] = []
            if retry_failed:
                conditions.append("status = 'failed'")
            if capture_dispatch_claimed:
                conditions.append("status = 'processing'")
            elif retry_processing_after_seconds is not None:
                conditions.append("(status = 'processing' AND updated_at <= ?)")
                condition_args.append(
                    (now - timedelta(seconds=retry_processing_after_seconds)).isoformat()
                )
            if conditions:
                cursor = conn.execute(
                    "UPDATE c_document_analyses SET status = 'processing', step = 'ocr', "
                    "result_json = NULL, error = NULL, attempt = attempt + 1, updated_at = ? "
                    f"WHERE document_id = ? AND ({' OR '.join(conditions)})",
                    (now_text, document_id, *condition_args),
                )
                if cursor.rowcount:
                    row = conn.execute(
                        "SELECT attempt FROM c_document_analyses WHERE document_id = ?",
                        (document_id,),
                    ).fetchone()
                    return row["attempt"]
        return None

    def update_step(self, document_id: int, step: str, *, attempt: int | None = None) -> None:
        if step not in ("ocr", "ai", "saving"):
            raise ValueError("지원하지 않는 분석 단계입니다.")
        with self._db() as conn:
            cursor = conn.execute(
                "UPDATE c_document_analyses SET step = ?, updated_at = ? "
                "WHERE document_id = ? AND status = 'processing'"
                + (" AND attempt = ?" if attempt is not None else ""),
                (step, _utc_now(), document_id, *([attempt] if attempt is not None else [])),
            )
            if cursor.rowcount != 1:
                raise AnalysisNotReady("진행 중인 분석을 찾지 못했어요.")

    def complete(self, document_id: int, result: dict[str, Any], *, attempt: int | None = None) -> None:
        if result.get("id") != document_id or result.get("status") != "completed":
            raise ValueError("저장할 결과의 문서 ID 또는 완료 상태가 맞지 않습니다.")
        serialized = json.dumps(result, ensure_ascii=False, separators=(",", ":"))
        with self._db() as conn:
            cursor = conn.execute(
                "UPDATE c_document_analyses SET status = 'completed', step = NULL, "
                "result_json = ?, error = NULL, updated_at = ? "
                "WHERE document_id = ? AND status = 'processing'"
                + (" AND attempt = ?" if attempt is not None else ""),
                (serialized, _utc_now(), document_id, *([attempt] if attempt is not None else [])),
            )
            if cursor.rowcount != 1:
                raise AnalysisNotReady("완료할 분석을 찾지 못했어요.")

    def fail(self, document_id: int, message: str, *, attempt: int | None = None) -> None:
        with self._db() as conn:
            conn.execute(
                "UPDATE c_document_analyses SET status = 'failed', step = NULL, "
                "result_json = NULL, error = ?, updated_at = ? "
                "WHERE document_id = ? AND status = 'processing'"
                + (" AND attempt = ?" if attempt is not None else ""),
                (message[:200], _utc_now(), document_id, *([attempt] if attempt is not None else [])),
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
