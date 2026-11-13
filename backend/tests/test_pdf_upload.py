import io, tempfile, unittest
from pathlib import Path
from uuid import uuid4
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pypdf import PdfWriter
from b_capture.router import create_capture_router
from b_capture.storage import CaptureStore
from c_analysis.ocr import UpstageDocumentParser


def pdf(count=2, password=None):
    writer=PdfWriter()
    for _ in range(count): writer.add_blank_page(width=595,height=842)
    if password: writer.encrypt(password)
    out=io.BytesIO();writer.write(out);return out.getvalue()


class PdfUploadTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();root=Path(self.tmp.name)
        self.store=CaptureStore(root/'test.db',root/'uploads')
        self.dispatched=[]
        app=FastAPI();app.include_router(create_capture_router(self.store,require_owner=lambda:'user',analyze=lambda i,p:self.dispatched.extend(p),analysis_status=lambda i:None))
        self.client=TestClient(app);self.doc=self.client.post('/documents').json()['id']
    def tearDown(self): self.tmp.cleanup()
    def upload(self,data,key=None):
        return self.client.post(f'/documents/{self.doc}/pages',files={'file':('paper.pdf',data,'application/pdf')},data={'client_page_id':key or str(uuid4())})
    def test_multipage_retry_and_pipeline(self):
        data=pdf();key=str(uuid4())
        first=self.upload(data,key);self.assertEqual(first.status_code,201,first.text)
        self.assertEqual(first.json()['file_page_count'],2)
        self.assertTrue(first.json()['filename'].endswith('.pdf'))
        self.assertEqual(self.upload(data,key).json(),first.json())
        self.assertEqual(self.client.post(f'/documents/{self.doc}/finish').json()['page_count'],1)
        self.assertEqual(len(self.dispatched),1);self.assertEqual(self.dispatched[0].read_bytes(),data)
        requests=[]
        class Response:
            def __enter__(self): return io.BytesIO(b'{"content":{"markdown":"Both pages"}}')
            def __exit__(self,*args): pass
        def opener(request,**kwargs): requests.append(request);return Response()
        result=UpstageDocumentParser(api_key='test-only',opener=opener).parse_pages(self.dispatched)
        self.assertIn('Both pages',result);self.assertIn(b'Content-Type: application/pdf',requests[0].data);self.assertIn(data,requests[0].data)
    def test_reject_bad_encrypted_and_too_many_pages(self):
        for data,code in [(b'%PDF-broken',400),(pdf(password='secret'),400),(pdf(101),413)]:
            self.assertEqual(self.upload(data).status_code,code)
        self.assertEqual(self.store.page_paths(self.doc,'user'),[])

if __name__=='__main__':unittest.main()
