import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../common/Header';
import { api } from '../api/client';
import DocumentProcessing from './DocumentProcessing';
import './fileUpload.css';
import Icon from '../utils/icons';
import { useT } from '../common/i18n';
import { useSettings } from '../common/SettingsContext';

const MAX_BYTES = 10 * 1024 * 1024;

export default function FileUpload() {
  const navigate = useNavigate();
  const t = useT();
  const { lang } = useSettings();
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
      setError(t('up.errType'));
      return;
    }
    if (selected.some(file => !file.size || file.size > MAX_BYTES)) {
      setError(t('up.errSize'));
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
      // 서버 오류 문장은 한국어라, 다른 말을 쓰면 번역된 안내로 바꿔 보여 줌
      if (mounted.current) setError(e.status === 0 ? t('err.network') : (lang === 'ko' && e.message) || t('up.errFail'));
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <div className="app file-upload">
      <Header title={t('up.title')} />
      <main className="body">
        <h1 className="h pre">{t('up.h')}</h1>
        <p className="pre">{t('up.desc')}</p>
        <input ref={input} type="file" accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf" multiple
          hidden aria-label={t('up.pickAria')} onChange={choose} disabled={locked} />
        <button className="big box" onClick={() => input.current?.click()} disabled={locked}>
          <b>{files.length ? t('up.pickMore') : t('up.pick')}</b>
        </button>
        {files.length > 0 && <>
          <p role="status">{t('up.count', { n: files.length })}</p>
          <ol className="upload-files">
            {files.map((item, index) => <li key={item.id}>
              {/\.pdf$/i.test(item.file.name)
                ? <span className="upload-pdf" aria-label={t('up.pdfAria')}><Icon name="doc" size={32} /><b>PDF</b></span>
                : <img src={item.url} alt={t('up.previewAlt', { n: index + 1 })} />}
              <span>{index + 1}. {item.file.name}</span>
              <button onClick={() => remove(item.id)} disabled={locked} aria-label={t('up.delAria', { name: item.file.name })}>{t('up.del')}</button>
            </li>)}
          </ol>
          <button className="big cam" onClick={upload} disabled={saving}>
            <b>{error && locked ? t('up.retry') : t('up.read')}</b>
          </button>
        </>}
        {error && <p role="alert">{error}</p>}
        {locked && !saving && error && <p>{t('up.changeHint')}</p>}
      </main>
      {saving && <div className="upload-processing"><DocumentProcessing step={step}
        title={t('up.busyTitle')} heading={t('up.busyH')}
        steps={[t('up.s1'), t('up.s2'), t('up.s3')]} /></div>}
    </div>
  );
}
