"""stone0min의 B 촬영 API와 C 조회 API를 한 앱에 붙였을 때의 계약 테스트."""

import json
import sqlite3
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from b_capture.dev_app import create_app
from b_capture.tests.test_capture import image_bytes, request
from c_analysis.analysis import AnalysisError
from c_analysis.pipeline import analyze_document
from c_analysis.router import create_analysis_router
from c_analysis.storage import SQLiteAnalysisStore


class BCompatibilityTests(unittest.TestCase):
    def test_only_b_registers_status_route(self):
        with tempfile.TemporaryDirectory() as directory:
            db_path = Path(directory) / "shared.sqlite"
            analysis_store = SQLiteAnalysisStore(db_path)
            app = create_app(
                data_dir=directory,
                db_path=db_path,
                analyze=lambda document_id, paths: None,
                analysis_status=analysis_store.status,
            )
            app.include_router(create_analysis_router(
                analysis_store,
                authorize_document_dependency=lambda: "local-dev",
            ))

            paths = []
            for route in app.routes:
                if hasattr(route, "path"):
                    paths.append(route.path)
                elif hasattr(route, "original_router"):
                    paths.extend(inner.path for inner in route.original_router.routes)
            self.assertEqual(paths.count("/documents/{document_id}/status"), 1)
            self.assertEqual(paths.count("/documents/{document_id}"), 1)

    def test_shared_status_contract_accepts_b_capturing(self):
        contract_path = Path(__file__).resolve().parents[2] / "contracts" / "document-status.schema.json"
        contract = json.loads(contract_path.read_text(encoding="utf-8"))
        statuses = contract["properties"]["status"]["enum"]
        self.assertEqual(
            statuses,
            ["capturing", "processing", "completed", "failed"],
        )


class BApiEndToEndTests(unittest.IsolatedAsyncioTestCase):
    async def test_b_upload_finish_and_c_status_result(self):
        with tempfile.TemporaryDirectory() as directory:
            db_path = Path(directory) / "shared.sqlite"
            analysis_store = SQLiteAnalysisStore(db_path)
            pages_seen = []

            class Parser:
                def parse_pages(self, paths):
                    pages_seen.extend(paths)
                    return "체험학습 11월 20일"

            class Analyzer:
                def analyze(self, text, *, document_id):
                    return {"id": document_id, "status": "completed", "title": "체험학습 안내문"}

            def run(document_id, paths):
                return analyze_document(
                    document_id, image_paths=paths, parser=Parser(),
                    analyzer=Analyzer(), store=analysis_store,
                    capture_dispatch_claimed=True,
                )

            app = create_app(
                data_dir=directory, db_path=db_path,
                analyze=run, analysis_status=analysis_store.status,
            )

            def authorize_document(document_id: int):
                return app.state.capture_store.document(document_id, "local-dev")

            app.include_router(create_analysis_router(
                analysis_store, authorize_document_dependency=authorize_document,
            ))

            code, document = await request(app, "POST", "/documents")
            self.assertEqual(code, 201)
            doc_id = document["id"]
            code, status = await request(app, "GET", f"/documents/{doc_id}/status")
            self.assertEqual((code, status["status"]), (200, "capturing"))

            code, _ = await request(
                app, "POST", f"/documents/{doc_id}/pages", photo=image_bytes(),
            )
            self.assertEqual(code, 201)
            code, finish = await request(app, "POST", f"/documents/{doc_id}/finish")
            self.assertEqual((code, finish["status"]), (202, "queued"))
            self.assertTrue(finish["analysis_connected"])
            self.assertEqual(len(pages_seen), 1)

            code, status = await request(app, "GET", f"/documents/{doc_id}/status")
            self.assertEqual((code, status["status"], status["done"]), (200, "completed", True))
            code, result = await request(app, "GET", f"/documents/{doc_id}")
            self.assertEqual((code, result["title"]), (200, "체험학습 안내문"))

    async def test_b_finish_retry_restarts_failed_c_without_extra_flag(self):
        with tempfile.TemporaryDirectory() as directory:
            db_path = Path(directory) / "shared.sqlite"
            analysis_store = SQLiteAnalysisStore(db_path)
            calls = []

            class Parser:
                def parse_pages(self, paths):
                    return "재시도할 문서"

            class Analyzer:
                def analyze(self, text, *, document_id):
                    calls.append(document_id)
                    if len(calls) == 1:
                        raise AnalysisError("일시적으로 분석하지 못했어요.")
                    return {"id": document_id, "status": "completed", "title": "재시도 완료"}

            analyzer = Analyzer()
            def run(document_id, paths):
                return analyze_document(
                    document_id, image_paths=paths, parser=Parser(),
                    analyzer=analyzer, store=analysis_store,
                    capture_dispatch_claimed=True,
                )

            app = create_app(
                data_dir=directory, db_path=db_path,
                analyze=run, analysis_status=analysis_store.status,
            )
            _, document = await request(app, "POST", "/documents")
            doc_id = document["id"]
            await request(app, "POST", f"/documents/{doc_id}/pages", photo=image_bytes())
            await request(app, "POST", f"/documents/{doc_id}/finish")
            self.assertEqual(analysis_store.status(doc_id)["status"], "failed")

            # B의 10분 경과 후 재배포 상황을 실제 공통 DB에서 재현합니다.
            with sqlite3.connect(db_path) as conn:
                conn.execute(
                    "UPDATE documents SET analysis_started_at = ? WHERE id = ?",
                    ((datetime.now(timezone.utc) - timedelta(minutes=11)).isoformat(), doc_id),
                )
            code, _ = await request(app, "POST", f"/documents/{doc_id}/finish")
            self.assertEqual(code, 202)
            self.assertEqual(analysis_store.status(doc_id)["status"], "completed")
            self.assertEqual(len(calls), 2)

    async def test_b_retry_restarts_processing_even_when_c_was_updated_recently(self):
        with tempfile.TemporaryDirectory() as directory:
            db_path = Path(directory) / "shared.sqlite"
            analysis_store = SQLiteAnalysisStore(db_path)
            dispatches = []

            class Parser:
                def parse_pages(self, paths):
                    return "다시 분석할 문서"

            class Analyzer:
                def analyze(self, text, *, document_id):
                    return {"id": document_id, "status": "completed", "title": "재시작 성공"}

            def run(document_id, paths):
                dispatches.append(document_id)
                if len(dispatches) == 1:
                    # 프로세스가 종료되어 C의 processing만 남는 상황을 재현합니다.
                    analysis_store.start(document_id)
                    return
                analyze_document(
                    document_id, image_paths=paths, parser=Parser(),
                    analyzer=Analyzer(), store=analysis_store,
                    capture_dispatch_claimed=True,
                )

            app = create_app(
                data_dir=directory, db_path=db_path,
                analyze=run, analysis_status=analysis_store.status,
            )
            _, document = await request(app, "POST", "/documents")
            doc_id = document["id"]
            await request(app, "POST", f"/documents/{doc_id}/pages", photo=image_bytes())
            await request(app, "POST", f"/documents/{doc_id}/finish")
            self.assertEqual(analysis_store.status(doc_id)["status"], "processing")

            # B의 lease만 오래되었고 C의 updated_at은 지금이어도 재시작되어야 합니다.
            with sqlite3.connect(db_path) as conn:
                conn.execute(
                    "UPDATE documents SET analysis_started_at = ? WHERE id = ?",
                    ((datetime.now(timezone.utc) - timedelta(minutes=11)).isoformat(), doc_id),
                )
            code, _ = await request(app, "POST", f"/documents/{doc_id}/finish")
            self.assertEqual(code, 202)
            self.assertEqual(analysis_store.status(doc_id)["status"], "completed")
            self.assertEqual(len(dispatches), 2)


if __name__ == "__main__":
    unittest.main()
