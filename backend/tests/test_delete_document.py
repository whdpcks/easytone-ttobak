"""D: DELETE /documents/{id} — 내 문서만 지워지고, 분석·번역·페이지 기록과 사진 폴더까지 함께 지워지는지"""
import json
import os
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient


class DeleteDocumentTest(unittest.TestCase):
    def test_owner_can_delete_and_everything_is_removed(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {
            "TTOBAK_DB_PATH": str(Path(folder) / "test.db"), "TTOBAK_DATA_DIR": folder,
            "TTOBAK_SEED_DEMO": "1", "TTOBAK_SMS_MODE": "demo", "UPSTAGE_API_KEY": "",
        }):
            from main import app
            with TestClient(app) as client:
                def login(phone):
                    code = client.post("/auth/send-code", json={"phone": phone, "purpose": "login"}).json()["demo_code"]
                    token = client.post("/auth/login", json={"phone": phone, "code": code}).json()["token"]
                    return {"Authorization": "Bearer " + token}

                me = login("01012345678")
                doc = client.post("/documents", headers=me).json()["id"]
                db_file = Path(folder) / "test.db"
                with closing(sqlite3.connect(db_file)) as db, db:
                    result = {"id": doc, "status": "completed", "title": "시험 문서", "category": "기타",
                              "created_at": "2026-11-14"}
                    db.execute("INSERT INTO c_document_analyses (document_id, status, result_json, updated_at) "
                               "VALUES (?, 'completed', ?, 'now')", (doc, json.dumps(result)))
                    db.execute("INSERT INTO c_document_translations (document_id, lang, source_hash, result_json, updated_at) "
                               "VALUES (?, 'en', 'x', '{}', 'now')", (doc,))
                    db.execute("INSERT INTO pages (id, document_id, page_number, filename, source_sha256, width, height) "
                               "VALUES ('p1', ?, 1, 'p1.jpg', 'x', 10, 10)", (doc,))
                    db.execute("INSERT INTO users (name, phone, created_at) VALUES ('other', '01099998888', 'now')")
                photos = Path(folder) / "uploads" / str(doc)
                photos.mkdir(parents=True, exist_ok=True)
                (photos / "p1.jpg").write_bytes(b"x")

                # 남의 문서는 404, 그대로 남아 있음
                other = login("01099998888")
                self.assertEqual(client.delete(f"/documents/{doc}", headers=other).status_code, 404)
                self.assertEqual(client.get(f"/documents/{doc}", headers=me).status_code, 200)

                # 내 문서는 204, 모든 기록과 사진 폴더가 사라짐
                self.assertEqual(client.delete(f"/documents/{doc}", headers=me).status_code, 204)
                with closing(sqlite3.connect(db_file)) as db, db:
                    for table, column in (("documents", "id"), ("pages", "document_id"),
                                          ("c_document_analyses", "document_id"),
                                          ("c_document_translations", "document_id")):
                        count = db.execute(f"SELECT COUNT(*) FROM {table} WHERE {column} = ?", (doc,)).fetchone()[0]
                        self.assertEqual(count, 0, table)
                self.assertFalse(photos.exists())
                self.assertEqual(client.get(f"/documents/{doc}", headers=me).status_code, 404)
                self.assertNotIn(doc, [d["id"] for d in client.get("/documents", headers=me).json()])

                # 이미 지운 문서를 또 지우면 404
                self.assertEqual(client.delete(f"/documents/{doc}", headers=me).status_code, 404)


if __name__ == "__main__":
    unittest.main()
