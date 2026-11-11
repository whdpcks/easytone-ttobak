import os,tempfile,unittest,io,sqlite3
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from fastapi.testclient import TestClient

class CommonCaptureTest(unittest.TestCase):
 def test_authenticated_capture_and_ownership(self):
  with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {'TTOBAK_DB_PATH':str(Path(folder)/'test.db'),'TTOBAK_DATA_DIR':folder,'TTOBAK_SEED_DEMO':'1','TTOBAK_SMS_MODE':'demo'}):
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
    image=io.BytesIO();Image.new('RGB',(100,150),'white').save(image,'JPEG')
    res=client.post(f'/documents/{doc}/pages',headers=h,files={'file':('paper.jpg',image.getvalue(),'image/jpeg')});self.assertEqual(res.status_code,201,res.text)
    self.assertEqual(client.post(f'/documents/{doc}/finish',headers=h).status_code,202)
    state=client.get(f'/documents/{doc}/status',headers=h).json()
    self.assertEqual(state['status'],'processing');self.assertFalse(state['done'])
if __name__=='__main__':unittest.main()
