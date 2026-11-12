import tempfile
import unittest
import sqlite3
from datetime import datetime, timedelta, timezone
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
        self.assertFalse(analyze_document(7, image_paths=["a.png"], parser=FakeParser(), analyzer=analyzer, store=self.store, retry_failed=False))
        # B는 finish 재호출 시 별도의 플래그를 넘기지 않으므로 기본값으로 재시도됩니다.
        self.assertTrue(analyze_document(7, image_paths=["a.png"], parser=FakeParser(), analyzer=analyzer, store=self.store))
        self.assertEqual(analyzer.attempts, 2)
        self.assertEqual(self.store.status(7)["status"], "completed")
        self.assertEqual(self.store.result(7)["title"], "재시도 성공")
        self.assertFalse(analyze_document(7, image_paths=["a.png"], parser=FakeParser(), analyzer=analyzer, store=self.store, retry_failed=True))

    def test_processing_analysis_cannot_retry(self):
        self.assertTrue(self.store.start(8))
        self.assertFalse(analyze_document(8, image_paths=["a.png"], parser=FakeParser(), analyzer=FakeAnalyzer(), store=self.store, retry_failed=True))
        self.assertEqual(self.store.status(8)["status"], "processing")

    def test_stale_processing_restarts_from_ocr(self):
        old_attempt = self.store.start(20)
        with sqlite3.connect(self.store.db_path) as conn:
            conn.execute(
                "UPDATE c_document_analyses SET updated_at = ? WHERE document_id = 20",
                ((datetime.now(timezone.utc) - timedelta(minutes=11)).isoformat(),),
            )
        self.assertTrue(analyze_document(
            20, image_paths=["a.png"], parser=FakeParser(),
            analyzer=FakeAnalyzer(), store=self.store,
        ))
        self.assertEqual(self.store.result(20)["title"], "건강검진 안내문")
        with self.assertRaises(AnalysisNotReady):
            self.store.update_step(20, "saving", attempt=old_attempt)

    def test_stale_worker_cannot_overwrite_new_attempt(self):
        old_attempt = self.store.start(21)
        with sqlite3.connect(self.store.db_path) as conn:
            conn.execute(
                "UPDATE c_document_analyses SET updated_at = ? WHERE document_id = 21",
                ((datetime.now(timezone.utc) - timedelta(minutes=11)).isoformat(),),
            )
        new_attempt = self.store.start(
            21, retry_failed=True, retry_processing_after_seconds=600,
        )
        self.assertNotEqual(old_attempt, new_attempt)
        with self.assertRaises(AnalysisNotReady):
            self.store.complete(
                21, {"id": 21, "status": "completed", "title": "오래된 결과"},
                attempt=old_attempt,
            )
        self.store.fail(21, "오래된 실행의 오류", attempt=old_attempt)
        self.assertEqual(self.store.status(21)["status"], "processing")
        self.store.complete(
            21, {"id": 21, "status": "completed", "title": "최신 결과"},
            attempt=new_attempt,
        )
        self.assertEqual(self.store.result(21)["title"], "최신 결과")

    def test_old_sqlite_schema_adds_attempt_without_losing_data(self):
        db_path = Path(self.temp.name) / "old.sqlite"
        with sqlite3.connect(db_path) as conn:
            conn.execute(
                "CREATE TABLE c_document_analyses (document_id INTEGER PRIMARY KEY,"
                " status TEXT, step TEXT, result_json TEXT, error TEXT, updated_at TEXT)"
            )
            conn.execute(
                "INSERT INTO c_document_analyses VALUES (1, 'failed', NULL, NULL, 'error', ?)",
                (datetime.now(timezone.utc).isoformat(),),
            )
        migrated = SQLiteAnalysisStore(db_path)
        self.assertTrue(migrated.start(1, retry_failed=True))
        self.assertEqual(migrated.status(1)["status"], "processing")

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
