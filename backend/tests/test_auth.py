"""A 담당 인증·내 정보·가족 API 테스트.

실행 (backend 폴더에서):
    python -m unittest tests.test_auth -v
"""
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient


class AuthApiTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.env = mock.patch.dict(os.environ, {
            "TTOBAK_DB_PATH": str(Path(self.tmp.name) / "test.db"),
            "TTOBAK_SEED_DEMO": "1",
            "TTOBAK_SMS_MODE": "demo",
        })
        self.env.start()
        os.environ.pop("TTOBAK_FIXED_CODE", None)

        from common import auth
        from common.db import init_db

        init_db()
        app = FastAPI()
        app.include_router(auth.router)

        @app.get("/documents/{document_id}/probe")
        def probe(document_id: int, user=Depends(auth.require_document_owner)):
            return {"ok": True, "user_id": user["id"]}

        self.client = TestClient(app)

    def tearDown(self):
        self.env.stop()
        self.tmp.cleanup()

    # ── 도우미 ──
    def _code(self, phone, purpose="login"):
        res = self.client.post("/auth/send-code", json={"phone": phone, "purpose": purpose})
        self.assertEqual(res.status_code, 200, res.text)
        code = res.json()["demo_code"]
        self.assertRegex(code, r"^\d{6}$")
        return code

    def _login(self, phone="010-1234-5678"):
        res = self.client.post("/auth/login", json={"phone": phone, "code": self._code(phone)})
        self.assertEqual(res.status_code, 200, res.text)
        return res.json()["token"]

    def _signup(self, phone="010-5555-6666", **extra):
        body = {"name": "응우옌", "phone": phone, "code": self._code(phone, "signup"), **extra}
        return self.client.post("/auth/signup", json=body)

    def _h(self, token):
        return {"Authorization": f"Bearer {token}"}

    # ── 인증번호 ──
    def test_send_code_checks_purpose(self):
        r = self.client.post("/auth/send-code", json={"phone": "01099998888", "purpose": "login"})
        self.assertEqual(r.status_code, 404)
        r = self.client.post("/auth/send-code", json={"phone": "01012345678", "purpose": "signup"})
        self.assertEqual(r.status_code, 409)

    def test_resend_too_fast_is_limited(self):
        self._code("01012345678")
        r = self.client.post("/auth/send-code", json={"phone": "01012345678"})
        self.assertEqual(r.status_code, 429)

    def test_login_with_sent_code(self):
        code = self._code("010-1234-5678")
        res = self.client.post("/auth/login", json={"phone": "01012345678", "code": code})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["user"]["name"], "김순자")
        # 한 번 쓴 번호는 다시 못 씀
        again = self.client.post("/auth/login", json={"phone": "01012345678", "code": code})
        self.assertEqual(again.status_code, 400)

    def test_wrong_code_then_locked_after_five(self):
        self._code("01012345678")
        for _ in range(5):
            r = self.client.post("/auth/login", json={"phone": "01012345678", "code": "999999x"})
            self.assertEqual(r.status_code, 400)
        r = self.client.post("/auth/login", json={"phone": "01012345678", "code": "999999x"})
        self.assertEqual(r.status_code, 429)

    def test_login_without_code_request(self):
        r = self.client.post("/auth/login", json={"phone": "01012345678", "code": "123456"})
        self.assertEqual(r.status_code, 400)

    def test_expired_code(self):
        code = self._code("01012345678")
        with mock.patch("common.auth.time.time", return_value=10**12):
            r = self.client.post("/auth/login", json={"phone": "01012345678", "code": code})
        self.assertEqual(r.status_code, 400)
        self.assertIn("시간", r.json()["detail"])

    def test_invalid_phone_gets_422(self):
        res = self.client.post("/auth/send-code", json={"phone": "12345"})
        self.assertEqual(res.status_code, 422)

    # ── 가입 ──
    def test_signup_requires_code_and_saves_settings(self):
        bad = self.client.post("/auth/signup", json={"name": "가", "phone": "01011112222", "code": "000000"})
        self.assertEqual(bad.status_code, 400)

        res = self._signup(language="vi", font_scale=1.5, voice_rate=0.8)
        self.assertEqual(res.status_code, 201, res.text)
        user = res.json()["user"]
        self.assertEqual((user["language"], user["font_scale"], user["voice_rate"]), ("vi", 1.5, 0.8))
        me = self.client.get("/me", headers=self._h(res.json()["token"]))
        self.assertEqual(me.json()["id"], user["id"])

    def test_signup_validation(self):
        self.assertEqual(self._signup(font_scale=2).status_code, 422)
        self.assertEqual(self._signup(phone="01022223333", language="xx").status_code, 422)

    def test_all_languages_accepted(self):
        from common.auth import LANGUAGES
        token = self._login()
        for lang in LANGUAGES:
            r = self.client.patch("/me", headers=self._h(token), json={"language": lang})
            self.assertEqual(r.status_code, 200, lang)

    # ── 내 정보 ──
    def test_me_requires_token(self):
        self.assertEqual(self.client.get("/me").status_code, 401)
        self.assertEqual(self.client.get("/me", headers=self._h("nope")).status_code, 401)

    def test_patch_me_updates_settings(self):
        token = self._login()
        res = self.client.patch("/me", headers=self._h(token), json={"font_scale": 1.5, "voice_rate": 0.8})
        self.assertEqual(res.json()["font_scale"], 1.5)
        self.assertEqual(res.json()["voice_rate"], 0.8)
        bad = self.client.patch("/me", headers=self._h(token), json={"font_scale": 3})
        self.assertEqual(bad.status_code, 422)

    def test_logout_invalidates_token(self):
        token = self._login()
        self.assertEqual(self.client.post("/auth/logout", headers=self._h(token)).status_code, 204)
        self.assertEqual(self.client.get("/me", headers=self._h(token)).status_code, 401)

    # ── 가족 ──
    def test_family_crud_and_isolation(self):
        token = self._login()
        fam = self.client.get("/me/family", headers=self._h(token)).json()
        self.assertEqual([(f["relation"], f["name"]) for f in fam], [("딸", "김미영")])

        add = self.client.post("/me/family", headers=self._h(token),
                               json={"relation": "아들", "name": "김민수", "phone": "010-2222-3333"})
        self.assertEqual(add.status_code, 201, add.text)
        new_id = add.json()["id"]

        other = self._signup().json()["token"]
        self.assertEqual(self.client.get("/me/family", headers=self._h(other)).json(), [])
        self.assertEqual(self.client.delete(f"/me/family/{new_id}", headers=self._h(other)).status_code, 404)
        self.assertEqual(self.client.delete(f"/me/family/{new_id}", headers=self._h(token)).status_code, 204)

        bad = self.client.post("/me/family", headers=self._h(token),
                               json={"relation": "친구", "name": "가", "phone": "01011112222"})
        self.assertEqual(bad.status_code, 422)

    # ── 문서 소유권 ──
    def test_document_owner_check(self):
        owner = self._login()
        other = self._signup().json()["token"]

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


class TtsTest(unittest.TestCase):
    def test_rate_format(self):
        from common.tts import rate_str
        self.assertEqual(rate_str(0.92), "-8%")
        self.assertEqual(rate_str(1.05), "+5%")
        self.assertEqual(rate_str(1.0), "+0%")

    def test_every_language_has_voice(self):
        from common.auth import LANGUAGES
        from common.tts import VOICES
        self.assertEqual(set(LANGUAGES), set(VOICES))


if __name__ == "__main__":
    unittest.main()
