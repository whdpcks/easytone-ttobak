import json
import os
import sqlite3
from contextlib import closing
from pathlib import Path

# C의 SQLiteAnalysisStore와 같은 팀 공통 DB 파일을 읽습니다.
DB_PATH = Path(os.getenv("TTOBAK_DB_PATH", "data/ttobak.db"))


def completed_documents() -> list[dict]:
    """C가 c_document_analyses에 저장한 완료 결과(document-result.schema.json)를 최신순으로 돌려줍니다."""
    if not DB_PATH.exists():
        return []
    with closing(sqlite3.connect(DB_PATH, timeout=10)) as conn:
        has_table = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'c_document_analyses'"
        ).fetchone()
        if not has_table:
            return []
        rows = conn.execute(
            "SELECT result_json FROM c_document_analyses "
            "WHERE status = 'completed' AND result_json IS NOT NULL"
        ).fetchall()
    docs = [json.loads(raw) for (raw,) in rows]
    docs.sort(key=lambda d: (d["created_at"], d["id"]), reverse=True)
    return docs
