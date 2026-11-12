import os,tempfile,unittest,sqlite3
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from c_analysis.analysis import SolarDocumentAnalyzer
from c_analysis.ocr import UpstageDocumentParser

class CommonCaptureTest(unittest.TestCase):
 def test_authenticated_capture_and_ownership(self):
  with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {'TTOBAK_DB_PATH':str(Path(folder)/'test.db'),'TTOBAK_DATA_DIR':folder,'TTOBAK_SEED_DEMO':'1','TTOBAK_SMS_MODE':'demo','UPSTAGE_API_KEY':''}):
   from main import app
   from common.auth import require_document_owner
   from fastapi import Depends
   @app.get('/_test/owner/{document_id}')
   def owner(document_id:int,user=Depends(require_document_owner)): return user
   with TestClient(app) as client:
    self.assertEqual(client.post('/documents').status_code,401)
    def login(phone):
     code=client.post('/auth/send-code',json={'phone':phone,'purpose':'login'}).json()['demo_code']
     return {'Authorization':'Bearer '+client.post('/auth/login',json={'phone':phone,'code':code}).json()['token']}
    h=login('01012345678')
    res=client.post('/documents',headers=h);self.assertEqual(res.status_code,201,res.text)
    doc=res.json()['id']
    self.assertEqual(client.get(f'/_test/owner/{doc}',headers=h).status_code,200)
    with sqlite3.connect(Path(folder)/'test.db') as db:
     user_id=db.execute('select user_id from documents where id=?',(doc,)).fetchone()[0]
     self.assertIsInstance(user_id,int)
     db.execute("insert into users(name,phone,created_at) values ('other','01099998888','now')")
    other=login('01099998888')
    self.assertEqual(client.get(f'/documents/{doc}/status',headers=other).status_code,404)
    self.assertEqual(client.get(f'/_test/owner/{doc}',headers=other).status_code,404)
    # OCR 시연용 가상 안내문: 시작일과 마감일이 다른 실제 PNG 파일이다.
    notice_image=(Path(__file__).parent/'fixtures'/'sample_application_notice.png').read_bytes()
    res=client.post(f'/documents/{doc}/pages',headers=h,files={'file':('notice.png',notice_image,'image/png')});self.assertEqual(res.status_code,201,res.text)
    finish=client.post(f'/documents/{doc}/finish',headers=h)
    self.assertEqual(finish.status_code,202)
    self.assertTrue(finish.json()['analysis_connected'])
    state=client.get(f'/documents/{doc}/status',headers=h).json()
    # 기존에는 AI 미연결 상태로 계속 대기했지만, 이제 API 키 오류를 안전하게 알린다.
    self.assertEqual(state['status'],'failed');self.assertTrue(state['done'])
    self.assertIn('연결되지',state['error'])

    # 실제 A 인증 + B 촬영 + C 결과 조회까지 가짜 AI 응답으로 통합 테스트한다.
    doc2=client.post('/documents',headers=h).json()['id']
    self.assertEqual(client.post(f'/documents/{doc2}/pages',headers=h,files={'file':('notice.png',notice_image,'image/png')}).status_code,201)
    with patch.object(UpstageDocumentParser,'parse_pages',return_value='신청 시작: 2026년 11월 20일\n신청 마감: 2026년 11월 30일') as parse_pages, patch.object(SolarDocumentAnalyzer,'analyze',return_value={'id':doc2,'status':'completed','title':'신청 안내문'}) as analyze:
     response=client.post(f'/documents/{doc2}/finish',headers=h)
    self.assertEqual(response.status_code,202)
    self.assertTrue(response.json()['analysis_connected'])
    parse_pages.assert_called_once()
    analyze.assert_called_once()
    state=client.get(f'/documents/{doc2}/status',headers=h).json()
    self.assertEqual(state['status'],'completed');self.assertTrue(state['done'])
    self.assertEqual(client.get(f'/documents/{doc2}',headers=h).json()['title'],'신청 안내문')
    self.assertEqual(client.get(f'/documents/{doc2}',headers=other).status_code,404)
if __name__=='__main__':unittest.main()
