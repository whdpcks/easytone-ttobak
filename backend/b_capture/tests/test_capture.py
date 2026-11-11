"""실제 ASGI 진입점을 사용한다. 테스트 DB·사진은 임시 폴더에만 저장한다."""
import asyncio
from io import BytesIO
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from uuid import uuid4

from PIL import Image

from b_capture.dev_app import create_app


def image_bytes(size=(100, 200), *, format="JPEG", orientation=None):
    with Image.new("RGB", size, "white") as image:
        output = BytesIO()
        options = {}
        if orientation:
            exif = image.getexif()
            exif[274] = orientation
            options["exif"] = exif
        image.save(output, format, **options)
        return output.getvalue()


async def request(app, method, path, *, body=None, photo=None, page_id=None):
    headers = []
    payload = b""
    if photo is not None:
        boundary = "ttobak-capture-test"
        parts = []
        if page_id:
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="client_page_id"\r\n\r\n{page_id}\r\n'.encode())
        parts.extend([
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="photo.jpg"\r\nContent-Type: image/jpeg\r\n\r\n'.encode(),
            photo, f'\r\n--{boundary}--\r\n'.encode(),
        ])
        payload = b"".join(parts)
        headers.append((b"content-type", f"multipart/form-data; boundary={boundary}".encode()))
    elif body is not None:
        payload = json.dumps(body).encode()
        headers.append((b"content-type", b"application/json"))
    headers.append((b"content-length", str(len(payload)).encode()))
    messages = []
    received = False

    async def receive():
        nonlocal received
        if not received:
            received = True
            return {"type": "http.request", "body": payload, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message):
        messages.append(message)

    await app({
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
        "method": method, "scheme": "http", "path": path, "raw_path": path.encode(),
        "query_string": b"", "root_path": "", "headers": headers,
        "server": ("localhost", 8000), "client": ("127.0.0.1", 1234),
    }, receive, send)
    status = next(message["status"] for message in messages if message["type"] == "http.response.start")
    content = b"".join(message.get("body", b"") for message in messages if message["type"] == "http.response.body")
    return status, json.loads(content)


class CaptureTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temporary = TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.app = create_app(data_dir=self.root)

    def tearDown(self):
        self.temporary.cleanup()

    async def document(self, app=None, key=None):
        status, result = await request(app or self.app, "POST", "/documents", body={"client_document_id": key} if key else None)
        self.assertEqual(status, 201)
        return result["id"]

    async def test_persistence_orientation_and_resize(self):
        document_id = await self.document()
        status, page = await request(self.app, "POST", f"/documents/{document_id}/pages", photo=image_bytes((3000, 1500), orientation=6))
        self.assertEqual(status, 201)
        self.assertEqual((page["width"], page["height"]), (1000, 2000))
        restarted = create_app(data_dir=self.root)
        paths = restarted.state.capture_store.page_paths(document_id, "local-dev")
        self.assertEqual(len(paths), 1)
        with Image.open(paths[0]) as image:
            self.assertEqual(image.format, "JPEG")
            self.assertEqual(image.size, (1000, 2000))
            self.assertNotIn(274, image.getexif())
        next_id = await self.document(restarted)
        self.assertGreater(next_id, document_id)

    async def test_document_and_page_retries_do_not_duplicate(self):
        key = str(uuid4())
        document_id = await self.document(key=key)
        self.assertEqual(await self.document(key=key), document_id)
        page_id = str(uuid4())
        payload = image_bytes()
        responses = await asyncio.gather(*[
            request(self.app, "POST", f"/documents/{document_id}/pages", photo=payload, page_id=page_id)
            for _ in range(2)
        ])
        self.assertEqual([response[0] for response in responses], [201, 201])
        self.assertEqual([response[1]["page_number"] for response in responses], [1, 1])
        self.assertEqual(len(self.app.state.capture_store.page_paths(document_id, "local-dev")), 1)
        status, _ = await request(self.app, "POST", f"/documents/{document_id}/pages", photo=image_bytes((200, 100)), page_id=page_id)
        self.assertEqual(status, 409)

    async def test_finish_keeps_order_and_locks_new_pages(self):
        document_id = await self.document()
        status, _ = await request(self.app, "POST", f"/documents/{document_id}/finish")
        self.assertEqual(status, 409)
        first_id = str(uuid4())
        for page_id in [first_id, str(uuid4())]:
            status, page = await request(self.app, "POST", f"/documents/{document_id}/pages", photo=image_bytes(), page_id=page_id)
            self.assertEqual(status, 201)
        paths = self.app.state.capture_store.page_paths(document_id, "local-dev")
        self.assertEqual(paths[0].name, f"{first_id}.jpg")
        for _ in range(2):
            status, result = await request(self.app, "POST", f"/documents/{document_id}/finish")
            self.assertEqual(status, 202)
            self.assertEqual(result, {"id": document_id, "status": "queued", "page_count": 2, "analysis_connected": False})
        status, _ = await request(self.app, "POST", f"/documents/{document_id}/pages", photo=image_bytes())
        self.assertEqual(status, 409)
        status, _ = await request(self.app, "POST", f"/documents/{document_id}/pages", photo=image_bytes(), page_id=first_id)
        self.assertEqual(status, 201)
        status, result = await request(self.app, "GET", f"/documents/{document_id}/status")
        self.assertEqual((status, result["status"], result["step"], result["done"]), (200, "processing", None, False))

    async def test_invalid_files_and_owner_access(self):
        document_id = await self.document()
        for payload, expected in [(b"not an image", 400), (b"", 400), (b"x" * (10 * 1024 * 1024 + 1), 413)]:
            status, _ = await request(self.app, "POST", f"/documents/{document_id}/pages", photo=payload)
            self.assertEqual(status, expected)
        other = create_app(data_dir=self.root, require_owner=lambda: "another-user")
        for method, suffix in [("GET", "status"), ("POST", "finish")]:
            status, _ = await request(other, method, f"/documents/{document_id}/{suffix}")
            self.assertEqual(status, 404)
        status, _ = await request(other, "POST", f"/documents/{document_id}/pages", photo=image_bytes())
        self.assertEqual(status, 404)

    async def test_failed_file_write_leaves_no_page_record(self):
        document_id = await self.document()
        with patch("b_capture.storage.os.replace", side_effect=OSError("disk unavailable")):
            with self.assertRaises(OSError):
                await request(self.app, "POST", f"/documents/{document_id}/pages", photo=image_bytes())
        self.assertEqual(self.app.state.capture_store.page_paths(document_id, "local-dev"), [])
        self.assertEqual(list((self.root / "uploads" / str(document_id)).iterdir()), [])

    async def test_analysis_callback_receives_ordered_paths_once(self):
        calls = []
        results = {}

        def analyze(document_id, paths):
            calls.append((document_id, paths))
            results[document_id] = {"id": document_id, "status": "completed", "step": None, "done": True, "error": None}

        def status(document_id):
            if document_id not in results:
                raise LookupError()
            return results[document_id]

        connected = create_app(data_dir=self.root, analyze=analyze, analysis_status=status)
        document_id = await self.document(connected)
        await request(connected, "POST", f"/documents/{document_id}/pages", photo=image_bytes())
        await asyncio.gather(*[request(connected, "POST", f"/documents/{document_id}/finish") for _ in range(2)])
        self.assertEqual(len(calls), 1)
        self.assertTrue(calls[0][1][0].is_file())
        code, progress = await request(connected, "GET", f"/documents/{document_id}/status")
        self.assertEqual((code, progress["status"], progress["done"]), (200, "completed", True))

    async def test_dispatch_failure_can_be_retried(self):
        should_fail = True
        results = {}

        def analyze(document_id, paths):
            if should_fail:
                raise RuntimeError("temporary failure")
            results[document_id] = {"id": document_id, "status": "completed", "step": None, "done": True, "error": None}

        def status(document_id):
            if document_id not in results:
                raise LookupError()
            return results[document_id]

        connected = create_app(data_dir=self.root, analyze=analyze, analysis_status=status)
        document_id = await self.document(connected)
        await request(connected, "POST", f"/documents/{document_id}/pages", photo=image_bytes())
        await request(connected, "POST", f"/documents/{document_id}/finish")
        _, failed = await request(connected, "GET", f"/documents/{document_id}/status")
        self.assertEqual(failed["status"], "failed")
        should_fail = False
        await request(connected, "POST", f"/documents/{document_id}/finish")
        _, complete = await request(connected, "GET", f"/documents/{document_id}/status")
        self.assertEqual(complete["status"], "completed")


if __name__ == "__main__":
    unittest.main()
