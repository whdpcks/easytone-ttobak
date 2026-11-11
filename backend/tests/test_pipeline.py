import tempfile
import unittest
from pathlib import Path

from c_analysis.analysis import AnalysisError
from c_analysis.pipeline import analyze_document
from c_analysis.storage import AnalysisNotFound, AnalysisNotReady, SQLiteAnalysisStore


class FakeParser:
    def parse_pages(self, image_paths):
        return "건강검진 안내 2026-11-20"


class FakeAnalyzer:
    def analyze(self, source_text, *, document_id):
        return {"id": document_id, "status": "completed", "title": "건강검진 안내문"}


class BrokenAnalyzer:
    def analyze(self, source_text, *, document_id):
        raise AnalysisError("AI 분석 결과를 확인하지 못했어요.")


class SometimesBrokenAnalyzer:
    def __init__(self):
        self.attempts = 0

    def analyze(self, source_text, *, document_id):
        self.attempts += 1
        if self.attempts == 1:
            raise AnalysisError("잠시 실패했어요.")
        return {"id": document_id, "status": "completed", "title": "재시도 성공"}


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = SQLiteAnalysisStore(Path(self.temp.name) / "app.sqlite")

    def tearDown(self):
        self.temp.cleanup()

    def test_happy_path_and_duplicate_requests(self):
        self.assertTrue(analyze_document(12, image_paths=["a.png"], parser=FakeParser(), analyzer=FakeAnalyzer(), store=self.store))
        self.assertFalse(analyze_document(12, image_paths=["a.png"], parser=FakeParser(), analyzer=FakeAnalyzer(), store=self.store))
        self.assertEqual(self.store.status(12), {"id": 12, "status": "completed", "step": None, "done": True, "error": None})
        self.assertEqual(self.store.result(12)["title"], "건강검진 안내문")

    def test_failed_analysis_reports_safe_error(self):
        self.assertTrue(analyze_document(2, image_paths=["a.png"], parser=FakeParser(), analyzer=BrokenAnalyzer(), store=self.store))
        status = self.store.status(2)
        self.assertEqual(status["status"], "failed")
        self.assertTrue(status["done"])
        self.assertIn("확인하지", status["error"])
        with self.assertRaises(AnalysisNotReady):
            self.store.result(2)
        self.assertTrue(self.store.start(2, retry_failed=True))

    def test_failed_analysis_restarts_actual_pipeline_and_completes(self):
        analyzer = SometimesBrokenAnalyzer()
        self.assertTrue(analyze_document(7, image_paths=["a.png"], parser=FakeParser(), analyzer=analyzer, store=self.store))
        self.assertEqual(self.store.status(7)["status"], "failed")
        self.assertFalse(analyze_document(7, image_paths=["a.png"], parser=FakeParser(), analyzer=analyzer, store=self.store))
        self.assertTrue(analyze_document(7, image_paths=["a.png"], parser=FakeParser(), analyzer=analyzer, store=self.store, retry_failed=True))
        self.assertEqual(analyzer.attempts, 2)
        self.assertEqual(self.store.status(7)["status"], "completed")
        self.assertEqual(self.store.result(7)["title"], "재시도 성공")
        self.assertFalse(analyze_document(7, image_paths=["a.png"], parser=FakeParser(), analyzer=analyzer, store=self.store, retry_failed=True))

    def test_processing_analysis_cannot_retry(self):
        self.assertTrue(self.store.start(8))
        self.assertFalse(analyze_document(8, image_paths=["a.png"], parser=FakeParser(), analyzer=FakeAnalyzer(), store=self.store, retry_failed=True))
        self.assertEqual(self.store.status(8)["status"], "processing")

    def test_processing_status(self):
        self.assertTrue(self.store.start(42))
        self.store.update_step(42, "ai")
        self.assertEqual(self.store.status(42)["step"], "ai")
        self.assertFalse(self.store.status(42)["done"])

    def test_only_own_table_is_created(self):
        import sqlite3

        with sqlite3.connect(self.store.db_path) as conn:
            table_names = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        self.assertIn("c_document_analyses", table_names)
        self.assertNotIn("documents", table_names)
        self.assertNotIn("pages", table_names)

    def test_unknown_document_is_404_equivalent(self):
        with self.assertRaises(AnalysisNotFound):
            self.store.status(999)


if __name__ == "__main__":
    unittest.main()
