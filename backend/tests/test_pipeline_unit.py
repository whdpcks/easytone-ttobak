"""SQLite 저장소 구현 전에도 파이프라인만 독립 검증할 수 있는 테스트."""

import unittest

from c_analysis.pipeline import analyze_document


class MemoryStore:
    def __init__(self):
        self.state = {}

    def start(self, document_id, *, retry_failed=False):
        state = self.state.get(document_id)
        if state is None or (state["status"] == "failed" and retry_failed):
            self.state[document_id] = {"status": "processing", "step": "ocr"}
            return True
        return False

    def update_step(self, document_id, step):
        self.state[document_id]["step"] = step

    def complete(self, document_id, result):
        self.state[document_id] = {"status": "completed", "result": result}

    def fail(self, document_id, message):
        self.state[document_id] = {"status": "failed", "error": message}


class ExampleParser:
    def parse_pages(self, image_paths):
        return "문서 원문"


class ExampleAnalyzer:
    def analyze(self, source_text, *, document_id):
        return {"id": document_id, "status": "completed", "summary": [source_text]}


class PipelineUnitTests(unittest.TestCase):
    def test_independent_pipeline_without_sqlite(self):
        store = MemoryStore()
        self.assertTrue(analyze_document(42, image_paths=["sample.png"], parser=ExampleParser(), analyzer=ExampleAnalyzer(), store=store))
        self.assertEqual(store.state[42]["status"], "completed")
        self.assertEqual(store.state[42]["result"]["summary"], ["문서 원문"])
        self.assertFalse(analyze_document(42, image_paths=["sample.png"], parser=ExampleParser(), analyzer=ExampleAnalyzer(), store=store))


if __name__ == "__main__":
    unittest.main()
