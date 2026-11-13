import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../common/Header';
import { api } from '../api/client';
import DocumentProcessing from './DocumentProcessing';
import './fileUpload.css';
import Icon from '../utils/icons';

const MAX_BYTES = 10 * 1024 * 1024;

export default function FileUpload() {
  const navigate = useNavigate();
  const input = useRef(null);
  const filesRef = useRef([]);
  const draft = useRef({ key: crypto.randomUUID(), id: null, uploaded: new Set() });
  const busy = useRef(false);
  const mounted = useRef(false);
  const [files, setFiles] = useState([]);
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      filesRef.current.forEach(file => URL.revokeObjectURL(file.url));
    };
  }, []);

  function choose(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (!selected.length || locked) return;
    if (selected.some(file => !/\.(jpe?g|png|pdf)$/i.test(file.name))) {
      setError('JPG, PNG 또는 PDF 파일을 선택해 주세요.');
      return;
    }
    if (selected.some(file => !file.size || file.size > MAX_BYTES)) {
      setError('비어 있지 않은 10MB 이하의 파일을 선택해 주세요.');
      return;
    }
    const added = selected.map(file => ({ file, id: crypto.randomUUID(), url: URL.createObjectURL(file) }));
    filesRef.current = [...filesRef.current, ...added];
    setFiles(filesRef.current);
    setError('');
  }

  function remove(id) {
    if (locked) return;
    const removed = filesRef.current.find(file => file.id === id);
    if (removed) URL.revokeObjectURL(removed.url);
    filesRef.current = filesRef.current.filter(file => file.id !== id);
    setFiles(filesRef.current);
  }

  async function upload() {
    if (busy.current || !files.length) return;
    busy.current = true;
    setSaving(true);
    setLocked(true);
    setError('');
    setStep(0);
    try {
      const document = draft.current;
      if (document.id === null) {
        const created = await api.post('/documents', { client_document_id: document.key });
        document.id = created.id;
      }
      setStep(1);
      for (const item of files) {
        if (document.uploaded.has(item.id)) continue;
        await api.upload(`/documents/${document.id}/pages`, { file: item.file, client_page_id: item.id });
        document.uploaded.add(item.id);
      }
      setStep(2);
      await api.post(`/documents/${document.id}/finish`);
      if (mounted.current) navigate(`/loading/${document.id}`, { replace: true });
    } catch (e) {
      if (mounted.current) setError(e.message || '파일을 올리지 못했어요. 다시 시도해 주세요.');
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <div className="app file-upload">
      <Header title="파일 업로드" />
      <main className="body">
        <h1 className="h">문서 파일을<br />선택해 주세요</h1>
        <p>JPG·PNG 사진과 PDF를 선택할 수 있어요.<br />파일당 최대 10MB, PDF는 최대 100페이지까지 가능해요.</p>
        <input ref={input} type="file" accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf" multiple
          hidden aria-label="문서 사진 선택" onChange={choose} disabled={locked} />
        <button className="big box" onClick={() => input.current?.click()} disabled={locked}>
          <b>{files.length ? '파일 더 선택하기' : '파일 선택하기'}</b>
        </button>
        {files.length > 0 && <>
          <p role="status">{files.length}개 파일을 선택했어요. PDF는 모든 페이지를 읽어요.</p>
          <ol className="upload-files">
            {files.map((item, index) => <li key={item.id}>
              {/\.pdf$/i.test(item.file.name)
                ? <span className="upload-pdf" aria-label="PDF 파일"><Icon name="doc" size={32} /><b>PDF</b></span>
                : <img src={item.url} alt={`${index + 1}번째 문서 미리보기`} />}
              <span>{index + 1}. {item.file.name}</span>
              <button onClick={() => remove(item.id)} disabled={locked} aria-label={`${item.file.name} 삭제`}>삭제</button>
            </li>)}
          </ol>
          <button className="big cam" onClick={upload} disabled={saving}>
            <b>{error && locked ? '다시 업로드하기' : 'AI로 문서 읽기'}</b>
          </button>
        </>}
        {error && <p role="alert">{error}</p>}
        {locked && !saving && error && <p>파일을 바꾸려면 홈으로 돌아간 뒤 다시 선택해 주세요.</p>}
      </main>
      {saving && <div className="upload-processing"><DocumentProcessing step={step}
        title="파일 업로드 중" heading={'선택한 문서를\n준비하고 있어요'}
        steps={['문서 준비', '파일 업로드', '분석 요청']} /></div>}
    </div>
  );
}
