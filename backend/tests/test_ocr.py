import io
import json
import tempfile
import unittest
from pathlib import Path
from urllib.error import HTTPError

from c_analysis.ocr import DocumentReadError, UpstageDocumentParser, text_from_parse_response


class _FakeResponse(io.BytesIO):
    def __init__(self, payload):
        super().__init__(json.dumps(payload).encode())


class UpstageOcrTests(unittest.TestCase):
    def test_prefers_markdown_when_available(self):
        self.assertEqual(
            text_from_parse_response({"content": {"markdown": "# 제목\n\n내용", "text": "제목 내용"}}),
            "# 제목\n\n내용",
        )

    def test_empty_document_gives_safe_error(self):
        with self.assertRaises(DocumentReadError):
            text_from_parse_response({"content": {"markdown": ""}, "elements": []})

    def test_multipart_request_and_page_order(self):
        received = []

        def fake_open(request, timeout):
            received.append(request)
            self.assertIn(b'name="model"', request.data)
            self.assertIn(b"document-parse", request.data)
            self.assertIn(b'filename="document.png"', request.data)
            self.assertEqual(timeout, 90)
            return _FakeResponse({"content": {"markdown": f"문서 {len(received)}"}})

        with tempfile.TemporaryDirectory() as temp_dir:
            one = Path(temp_dir) / "one.png"
            two = Path(temp_dir) / "two.png"
            one.write_bytes(b"image one")
            two.write_bytes(b"image two")
            reader = UpstageDocumentParser(api_key="test-key", opener=fake_open)
            self.assertEqual(
                reader.parse_pages([one, two]),
                "[페이지 1]\n문서 1\n\n[페이지 2]\n문서 2",
            )
            self.assertEqual(len(received), 2)

    def test_fails_if_no_key_or_file(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "a.png"
            path.write_bytes(b"image")
            with self.assertRaisesRegex(DocumentReadError, "연결되지"):
                UpstageDocumentParser(api_key="").parse_image(path)
            with self.assertRaisesRegex(DocumentReadError, "찾을 수"):
                UpstageDocumentParser(api_key="test-key").parse_image(path.with_name("missing.png"))

    def test_retries_transient_http_error_once(self):
        calls = 0

        def fake_open(_request, timeout):
            nonlocal calls
            calls += 1
            if calls == 1:
                raise HTTPError("test", 503, "busy", {}, None)
            return _FakeResponse({"content": {"text": "읽은 글자"}})

        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "a.jpg"
            path.write_bytes(b"image")
            reader = UpstageDocumentParser(api_key="test-key", opener=fake_open)
            self.assertEqual(reader.parse_image(path), "읽은 글자")
            self.assertEqual(calls, 2)


if __name__ == "__main__":
    unittest.main()
