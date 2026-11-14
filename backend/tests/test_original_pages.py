"""D: 원문 보기 — GET /documents/{id}/pages, /pages/{page_id}/file
올린 사진은 JPG로, 올린 PDF는 바이트까지 그대로 돌려주고, 내 문서만 볼 수 있는지"""
import io
import os
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from pypdf import PdfWriter


def blank_pdf() -> bytes:
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=300)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


class OriginalPagesTest(unittest.TestCase):
    def test_owner_gets_original_photo_and_pdf(self):
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
                photo = (Path(__file__).parent / "fixtures" / "sample_application_notice.png").read_bytes()
                pdf = blank_pdf()
                r1 = client.post(f"/documents/{doc}/pages", headers=me, files={"file": ("a.png", photo, "image/png")})
                r2 = client.post(f"/documents/{doc}/pages", headers=me, files={"file": ("b.pdf", pdf, "application/pdf")})
                self.assertEqual((r1.status_code, r2.status_code), (201, 201), r1.text + r2.text)

                pages = client.get(f"/documents/{doc}/pages", headers=me).json()
                self.assertEqual([p["kind"] for p in pages], ["image", "pdf"])
                self.assertEqual([p["page_number"] for p in pages], [1, 2])

                img = client.get(f"/documents/{doc}/pages/{pages[0]['id']}/file", headers=me)
                self.assertEqual(img.status_code, 200)
                self.assertEqual(img.headers["content-type"], "image/jpeg")
                self.assertTrue(img.content.startswith(b"\xff\xd8"))  # JPG

                got = client.get(f"/documents/{doc}/pages/{pages[1]['id']}/file", headers=me)
                self.assertEqual(got.headers["content-type"], "application/pdf")
                self.assertEqual(got.content, pdf)  # 올린 PDF 그대로

                # 로그인 안 함 401, 남의 문서 404, 없는 페이지 404
                self.assertEqual(client.get(f"/documents/{doc}/pages").status_code, 401)
                with closing(sqlite3.connect(Path(folder) / "test.db")) as db, db:
                    db.execute("INSERT INTO users (name, phone, created_at) VALUES ('other', '01099998888', 'now')")
                other = login("01099998888")
                self.assertEqual(client.get(f"/documents/{doc}/pages", headers=other).status_code, 404)
                self.assertEqual(client.get(f"/documents/{doc}/pages/{pages[0]['id']}/file", headers=other).status_code, 404)
                self.assertEqual(client.get(f"/documents/{doc}/pages/nope/file", headers=me).status_code, 404)
                self.assertEqual(client.get(f"/documents/{doc}/pages/..%2F..%2Ftest.db/file", headers=me).status_code, 404)


if __name__ == "__main__":
    unittest.main()
