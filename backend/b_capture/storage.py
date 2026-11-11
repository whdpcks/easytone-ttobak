"""SQLite 문서 기록과 촬영 순서. 파일명 대신 DB 기록으로 분석할 사진을 조회한다."""
from contextlib import contextmanager, closing
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import NamedTemporaryFile
import os
import sqlite3

from .images import CaptureError


class CaptureStore:
    def __init__(self, db_path: Path, upload_dir: Path):
        self.db_path = Path(db_path)
        self.upload_dir = Path(upload_dir)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        with self._db() as connection:
            connection.executescript("""
                CREATE TABLE IF NOT EXISTS documents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    owner_id TEXT NOT NULL,
                    user_id INTEGER,
                    request_key TEXT,
                    status TEXT NOT NULL DEFAULT 'capturing'
                        CHECK(status IN ('capturing', 'queued')),
                    created_at TEXT NOT NULL,
                    analysis_requested_at TEXT,
                    analysis_started_at TEXT,
                    analysis_error TEXT,
                    UNIQUE(owner_id, request_key)
                );
                CREATE TABLE IF NOT EXISTS pages (
                    id TEXT NOT NULL,
                    document_id INTEGER NOT NULL REFERENCES documents(id),
                    page_number INTEGER NOT NULL,
                    filename TEXT NOT NULL,
                    source_sha256 TEXT NOT NULL,
                    width INTEGER NOT NULL,
                    height INTEGER NOT NULL,
                    PRIMARY KEY(document_id, id),
                    UNIQUE(document_id, page_number)
                );
            """)

        # 기존 B 개발 DB에도 A의 공통 소유권 검사 열을 추가한다.
        with self._db(write=True) as connection:
            columns = {row["name"] for row in connection.execute("PRAGMA table_info(documents)")}
            if "user_id" not in columns:
                connection.execute("ALTER TABLE documents ADD COLUMN user_id INTEGER")
            connection.execute("UPDATE documents SET user_id = CAST(owner_id AS INTEGER) "
                               "WHERE user_id IS NULL AND owner_id != '' AND owner_id NOT GLOB '*[^0-9]*'")

    @contextmanager
    def _db(self, *, write: bool = False):
        with closing(sqlite3.connect(self.db_path, timeout=10)) as connection:
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA foreign_keys = ON")
            if write:
                connection.execute("BEGIN IMMEDIATE")
            with connection:
                yield connection

    @staticmethod
    def _document(connection, document_id: int, owner_id: str):
        document = connection.execute(
            "SELECT * FROM documents WHERE id = ? AND owner_id = ?",
            (document_id, owner_id),
        ).fetchone()
        if document is None:
            raise CaptureError(404, "문서 번호를 찾을 수 없어요.")
        return document

    def document(self, document_id: int, owner_id: str) -> dict:
        with self._db() as connection:
            return dict(self._document(connection, document_id, owner_id))

    def create_document(self, owner_id: str, request_key: str | None) -> int:
        with self._db(write=True) as connection:
            if request_key:
                existing = connection.execute(
                    "SELECT id FROM documents WHERE owner_id = ? AND request_key = ?",
                    (owner_id, request_key),
                ).fetchone()
                if existing:
                    return existing["id"]
            cursor = connection.execute(
                "INSERT INTO documents (owner_id, user_id, request_key, created_at) VALUES (?, ?, ?, ?)",
                (owner_id, int(owner_id) if str(owner_id).isdigit() else None, request_key, datetime.now(timezone.utc).isoformat()),
            )
            return cursor.lastrowid

    def add_page(self, document_id: int, owner_id: str, page_id: str,
                 source_sha256: str, image: bytes, width: int, height: int) -> dict:
        with self._db(write=True) as connection:
            document = self._document(connection, document_id, owner_id)
            existing = connection.execute(
                "SELECT * FROM pages WHERE document_id = ? AND id = ?", (document_id, page_id),
            ).fetchone()
            if existing:
                if existing["source_sha256"] != source_sha256:
                    raise CaptureError(409, "같은 사진 번호에 다른 사진을 보낼 수 없어요.")
                return dict(existing)
            if document["status"] != "capturing":
                raise CaptureError(409, "촬영이 끝난 문서에는 사진을 추가할 수 없어요.")
            page_number = connection.execute(
                "SELECT COALESCE(MAX(page_number), 0) + 1 FROM pages WHERE document_id = ?",
                (document_id,),
            ).fetchone()[0]
            folder = self.upload_dir / str(document_id)
            folder.mkdir(parents=True, exist_ok=True)
            filename = f"{page_id}.jpg"
            temporary_path = None
            try:
                with NamedTemporaryFile(dir=folder, suffix=".tmp", delete=False) as temporary:
                    temporary_path = Path(temporary.name)
                    temporary.write(image)
                    temporary.flush()
                    os.fsync(temporary.fileno())
                os.replace(temporary_path, folder / filename)
                connection.execute(
                    "INSERT INTO pages VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (page_id, document_id, page_number, filename, source_sha256, width, height),
                )
            finally:
                if temporary_path:
                    temporary_path.unlink(missing_ok=True)
            return {
                "id": page_id, "document_id": document_id, "page_number": page_number,
                "filename": filename, "width": width, "height": height,
            }

    def finish(self, document_id: int, owner_id: str) -> int:
        with self._db(write=True) as connection:
            self._document(connection, document_id, owner_id)
            count = connection.execute(
                "SELECT COUNT(*) FROM pages WHERE document_id = ?", (document_id,),
            ).fetchone()[0]
            if count == 0:
                raise CaptureError(409, "사진을 한 장 이상 찍어주세요.")
            connection.execute(
                "UPDATE documents SET status = 'queued', "
                "analysis_requested_at = COALESCE(analysis_requested_at, ?) WHERE id = ?",
                (datetime.now(timezone.utc).isoformat(), document_id),
            )
            return count

    def page_paths(self, document_id: int, owner_id: str) -> list[Path]:
        with self._db() as connection:
            self._document(connection, document_id, owner_id)
            pages = connection.execute(
                "SELECT filename FROM pages WHERE document_id = ? ORDER BY page_number",
                (document_id,),
            ).fetchall()
        return [self.upload_dir / str(document_id) / page["filename"] for page in pages]

    def claim_analysis(self, document_id: int) -> bool:
        # A stale dispatch can be retried after 10 minutes. C's handler must be idempotent.
        now = datetime.now(timezone.utc)
        with self._db(write=True) as connection:
            cursor = connection.execute(
                "UPDATE documents SET analysis_started_at = ?, analysis_error = NULL "
                "WHERE id = ? AND status = 'queued' "
                "AND (analysis_started_at IS NULL OR analysis_started_at < ?)",
                (now.isoformat(), document_id, (now - timedelta(minutes=10)).isoformat()),
            )
            return cursor.rowcount == 1

    def dispatch_failed(self, document_id: int):
        with self._db(write=True) as connection:
            connection.execute(
                "UPDATE documents SET analysis_started_at = NULL, analysis_error = ? WHERE id = ?",
                ("문서 읽기를 시작하지 못했어요. 다시 시도해주세요.", document_id),
            )
