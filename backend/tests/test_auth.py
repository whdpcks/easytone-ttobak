"""A 담당 인증 API 테스트.

실행 (backend 폴더에서):
    python -m unittest tests.test_auth -v
"""
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient


class AuthApiTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["TTOBAK_DB_PATH"] = str(Path(self.tmp.name) / "test.db")
        os.environ["TTOBAK_SEED_DEMO"] = "1"

        from common import auth
        from common.db import init_db

        init_db()
        self.auth = auth
        app = FastAPI()
        app.include_router(auth.router)

        @app.get("/documents/{document_id}/probe")
        def probe(document_id: int, user=Depends(auth.require_document_owner)):
            return {"ok": True, "user_id": user["id"]}

        self.client = TestClient(app)

    def tearDown(self):
        self.tmp.cleanup()
        os.environ.pop("TTOBAK_DB_PATH", None)

    def _login(self, phone="010-1234-5678"):
        res = self.client.post("/auth/login", json={"phone": phone, "code": "000000"})
        self.assertEqual(res.status_code, 200, res.text)
        return res.json()["token"]

    def _h(self, token):
        return {"Authorization": f"Bearer {token}"}

    def test_demo_user_can_login_with_fixed_code(self):
        res = self.client.post("/auth/login", json={"phone": "010-1234-5678", "code": "000000"})
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body["token"])
        self.assertEqual(body["user"]["name"], "김순자")
        self.assertEqual(body["user"]["phone"], "01012345678")

    def test_wrong_code_is_rejected(self):
        res = self.client.post("/auth/login", json={"phone": "01012345678", "code": "123456"})
        self.assertEqual(res.status_code, 400)

    def test_unknown_phone_gets_404(self):
        res = self.client.post("/auth/login", json={"phone": "01099998888", "code": "000000"})
        self.assertEqual(res.status_code, 404)

    def test_invalid_phone_gets_422(self):
        res = self.client.post("/auth/login", json={"phone": "12345", "code": "000000"})
        self.assertEqual(res.status_code, 422)

    def test_signup_returns_token_and_duplicate_conflicts(self):
        body = {"name": " 응우옌 ", "phone": "010-5555-6666", "language": "vi", "font_scale": 1.5}
        res = self.client.post("/auth/signup", json=body)
        self.assertEqual(res.status_code, 201, res.text)
        user = res.json()["user"]
        self.assertEqual(user["name"], "응우옌")
        self.assertEqual(user["language"], "vi")
        self.assertEqual(user["font_scale"], 1.5)
        me = self.client.get("/me", headers=self._h(res.json()["token"]))
        self.assertEqual(me.json()["id"], user["id"])
        again = self.client.post("/auth/signup", json=body)
        self.assertEqual(again.status_code, 409)

    def test_signup_rejects_unknown_font_scale(self):
        res = self.client.post("/auth/signup", json={"name": "가", "phone": "01011112222", "font_scale": 2})
        self.assertEqual(res.status_code, 422)

    def test_me_requires_token(self):
        self.assertEqual(self.client.get("/me").status_code, 401)
        self.assertEqual(self.client.get("/me", headers=self._h("nope")).status_code, 401)

    def test_patch_me_updates_settings(self):
        token = self._login()
        res = self.client.patch("/me", headers=self._h(token), json={"font_scale": 1.5, "voice_rate": 0.8})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["font_scale"], 1.5)
        self.assertEqual(res.json()["voice_rate"], 0.8)
        bad = self.client.patch("/me", headers=self._h(token), json={"font_scale": 3})
        self.assertEqual(bad.status_code, 422)

    def test_logout_invalidates_token(self):
        token = self._login()
        self.assertEqual(self.client.post("/auth/logout", headers=self._h(token)).status_code, 204)
        self.assertEqual(self.client.get("/me", headers=self._h(token)).status_code, 401)

    def test_document_owner_check(self):
        owner = self._login()
        other = self.client.post(
            "/auth/signup", json={"name": "다른 사람", "phone": "01077778888"}
        ).json()["token"]

        # B의 documents 테이블이 없으면 아무 문서도 열 수 없다
        self.assertEqual(self.client.get("/documents/1/probe", headers=self._h(owner)).status_code, 404)

        db = sqlite3.connect(os.environ["TTOBAK_DB_PATH"])
        db.execute("CREATE TABLE documents (id INTEGER PRIMARY KEY, user_id INTEGER, status TEXT)")
        db.execute("INSERT INTO documents (id, user_id, status) VALUES (1, 1, 'done')")
        db.commit()
        db.close()

        self.assertEqual(self.client.get("/documents/1/probe", headers=self._h(owner)).status_code, 200)
        self.assertEqual(self.client.get("/documents/1/probe", headers=self._h(other)).status_code, 404)
        self.assertEqual(self.client.get("/documents/2/probe", headers=self._h(owner)).status_code, 404)
        self.assertEqual(self.client.get("/documents/1/probe").status_code, 401)


if __name__ == "__main__":
    unittest.main()
