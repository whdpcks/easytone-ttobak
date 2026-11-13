import json
import os
import sqlite3
from contextlib import closing
from pathlib import Path

# A의 common.db, C의 SQLiteAnalysisStore와 같은 팀 공통 DB 파일을 읽습니다.
DB_PATH = Path(os.getenv("TTOBAK_DB_PATH", "data/ttobak.db"))


def completed_documents(user_id: int) -> list[dict]:
    """이 사용자(B의 documents.user_id) 문서 중 C가 분석을 끝낸 결과만 최신순으로 돌려줍니다."""
    if not DB_PATH.exists():
        return []
    with closing(sqlite3.connect(DB_PATH, timeout=10)) as conn:
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        if not {"c_document_analyses", "documents"} <= tables:
            return []
        rows = conn.execute(
            "SELECT a.result_json FROM c_document_analyses a "
            "JOIN documents d ON d.id = a.document_id "
            "WHERE d.user_id = ? AND a.status = 'completed' AND a.result_json IS NOT NULL",
            (user_id,),
        ).fetchall()
    docs = [json.loads(raw) for (raw,) in rows]
    docs.sort(key=lambda d: (d["created_at"], d["id"]), reverse=True)
    return docs


def with_cached_translations(docs: list[dict], lang: str | None) -> list[dict]:
    """C가 이미 번역해 둔 문서(c_document_translations)는 번역본으로 바꿉니다.
    번역본에는 "lang"을 붙이고, 아직 번역이 없는 문서는 한국어 원본 그대로 둡니다.
    (새 번역은 만들지 않습니다 — 프론트가 C의 /documents/{id}/translation 으로 요청)"""
    if not lang or lang == "ko" or not docs:
        return docs
    from c_analysis.storage import SQLiteAnalysisStore  # C의 캐시 규칙(원본이 바뀌면 무효)을 그대로 사용

    store = SQLiteAnalysisStore(DB_PATH)
    out = []
    for doc in docs:
        cached = store.get_translation(doc["id"], lang, doc)
        out.append({**cached, "lang": lang} if cached else doc)
    return out
