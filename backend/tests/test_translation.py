"""C: 번역 조회/소유권/캐시와 사실값 불변을 확인한다."""
import io
import json
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from fastapi.testclient import TestClient

from c_analysis.router import create_analysis_router
from c_analysis.storage import SQLiteAnalysisStore
from c_analysis.translation import SolarDocumentTranslator, TranslationError, translate_document

SOURCE = {
    "id": 7, "status": "completed", "title": "11월 신청 안내", "sender": "시청",
    "category": "나라·복지", "created_at": "2026-11-13",
    "summary": ["11월 30일까지 12,000원을 내세요."],
    "datetime": {"date": "2026-11-30", "time": "10:00", "label": "신청 마감", "note": None, "check": False},
    "place": {"name": "시청 2층", "address": "서울시 종로구", "note": "입구에서 접수하세요."},
    "items": [{"name": "신분증", "detail": None}],
    "cautions": ["11월 30일 이후에는 신청하지 못해요."],
    "contact": {"name": "담당 부서", "phone": "02-1234-5678"},
}


class TranslationUnitTests(unittest.TestCase):
    def test_same_shape_and_original_unchanged(self):
        class Fake:
            def translate_strings(self, texts, lang):
                return ["VI: " + t for t in texts]
        source = deepcopy(SOURCE)
        got = translate_document(source, lang="vi", translator=Fake())
        self.assertEqual(source, SOURCE)
        self.assertEqual(set(got), set(SOURCE))
        self.assertEqual(got["datetime"]["date"], SOURCE["datetime"]["date"])
        self.assertEqual(got["datetime"]["time"], SOURCE["datetime"]["time"])
        self.assertEqual(got["contact"], SOURCE["contact"])
        self.assertEqual(got["place"]["address"], SOURCE["place"]["address"])
        self.assertEqual(got["category"], SOURCE["category"])
        self.assertTrue(got["summary"][0].startswith("VI: "))

    def test_solar_rejects_changed_numeric_facts(self):
        def fake(request, timeout):
            return io.BytesIO(json.dumps({"choices": [{"message": {
                "content": '{"translations":["20,000원"]}'
            }}]}).encode())
        with self.assertRaises(TranslationError):
            SolarDocumentTranslator(api_key="fake", opener=fake).translate_strings(["12,000원"], "vi")

    def test_no_api_key(self):
        with self.assertRaises(TranslationError):
            SolarDocumentTranslator(api_key="").translate_strings(["문서"], "vi")


class TranslationApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.store = SQLiteAnalysisStore(Path(self.tmp.name) / "db.sqlite")
        self.store.start(7)
        self.store.complete(7, deepcopy(SOURCE))
        self.calls = 0
        outer = self

        class Fake:
            def translate_strings(self, texts, lang):
                outer.calls += 1
                return ["VI: " + t for t in texts]

        def owner(document_id: int, authorization: str | None = Header(None)):
            if authorization != "Bearer owner":
                raise HTTPException(status_code=404, detail="문서를 찾을 수 없어요.")

        app = FastAPI()
        app.include_router(create_analysis_router(
            self.store, authorize_document_dependency=owner, translator_factory=Fake
        ))
        self.client = TestClient(app)

    def get(self, lang="vi", token="Bearer owner"):
        return self.client.get(
            f"/documents/7/translation?lang={lang}", headers={"Authorization": token}
        )

    def test_other_user_and_bad_language(self):
        self.assertEqual(self.get(token="Bearer other").status_code, 404)
        self.assertEqual(self.get(lang="xx").status_code, 422)
        self.assertEqual(self.calls, 0)

    def test_korean_unchanged_and_cached(self):
        self.assertEqual(self.get(lang="ko").json(), SOURCE)
        self.assertEqual(self.calls, 0)
        self.assertEqual(self.get().status_code, 200)
        self.assertEqual(self.get().status_code, 200)
        self.assertEqual(self.calls, 1)
        self.assertEqual(self.client.get(
            "/documents/7", headers={"Authorization": "Bearer owner"}
        ).json(), SOURCE)

    def test_cache_invalidated_when_source_changes(self):
        self.get()
        new_doc = deepcopy(SOURCE)
        new_doc["summary"] = ["11월 30일까지 14,000원을 내세요."]
        with self.store._db() as conn:
            conn.execute(
                "UPDATE c_document_analyses SET result_json = ? WHERE document_id = ?",
                (json.dumps(new_doc, ensure_ascii=False), 7),
            )
        self.assertEqual(self.get().status_code, 200)
        self.assertEqual(self.calls, 2)


if __name__ == "__main__":
    unittest.main()
