/* ─────────────────────────────────────────────
   D 담당 — 사용할 말에 맞춘 문서 불러오기

   const { doc, error, translating, fallback, retry } = useDocument(docId);
     - 한국어가 아니면 C의 번역 API로 받아요. (서버에 캐시돼서 두 번째부터는 바로 와요)
     - 번역이 실패하면 한국어 원문을 보여주고 fallback=true → 화면에 "한국어 원문" 표시 + 다시 시도
     - error: 'reading'(아직 분석 중, 409) | 'notFound'

   const docs = useTranslatedDocs(list);
     - 목록의 문서 중 아직 번역이 없는 것만 하나씩 번역을 받아서 바꿔 끼워요.
───────────────────────────────────────────── */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '../common/SettingsContext';
import { getDocument } from '../api/documents';
import { docLang } from '../utils/archiveText';

/** 번역은 AI라 가끔 숫자 검사에 걸려 503이 나요. 그때만 한 번 더 요청합니다. */
async function getWithRetry(id, lang) {
  try {
    return await getDocument(id, lang);
  } catch (e) {
    if (lang === 'ko' || e.status !== 503) throw e;
    return getDocument(id, lang);
  }
}

export function useDocument(docId) {
  const lang = docLang(useSettings().lang);  // D는 한·영·일·중만, 그 외는 영어
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({ doc: null, error: null, translating: false, fallback: false });

  useEffect(() => {
    let alive = true;
    setState({ doc: null, error: null, translating: lang !== 'ko', fallback: false });
    (async () => {
      try {
        const doc = await getWithRetry(docId, lang);
        if (alive) setState({ doc, error: null, translating: false, fallback: false });
      } catch (e) {
        if (!alive) return;
        let err = e;
        // 번역만 실패(503·422·네트워크)했으면 한국어 원문으로 보여줌
        if (lang !== 'ko' && e.status !== 404 && e.status !== 409 && e.status !== 401) {
          try {
            const doc = await getDocument(docId, 'ko');
            if (alive) setState({ doc, error: null, translating: false, fallback: true });
            return;
          } catch (e2) { err = e2; }
        }
        if (alive) setState({ doc: null, error: err.status === 409 ? 'reading' : 'notFound', translating: false, fallback: false });
      }
    })();
    return () => { alive = false; };
  }, [docId, lang, tick]);

  const retry = useCallback(() => setTick(x => x + 1), []);
  return { ...state, retry };
}

/** 목록 문서를 지금 언어로. 서버가 캐시 번역을 붙여 준 것(doc.lang === lang)은 그대로,
    나머지는 2개씩 번역을 받아 바꿔 끼움. 실패하면 한국어 그대로 둠. */
export function useTranslatedDocs(docs) {
  const lang = docLang(useSettings().lang);  // D는 한·영·일·중만, 그 외는 영어
  const [done, setDone] = useState({});        // id → 번역본 (지금 언어)
  const failed = useRef(new Set());

  useEffect(() => { setDone({}); failed.current = new Set(); }, [lang]);

  useEffect(() => {
    if (lang === 'ko' || !docs?.length) return undefined;
    let alive = true;
    const todo = docs.filter(d => d && d.lang !== lang && !done[d.id] && !failed.current.has(d.id)).map(d => d.id);
    if (!todo.length) return undefined;
    const worker = async () => {
      while (alive && todo.length) {
        const id = todo.shift();
        try {
          const t = await getWithRetry(id, lang);
          if (alive) setDone(prev => ({ ...prev, [id]: { ...t, lang } }));
        } catch { failed.current.add(id); }
      }
    };
    worker(); worker();
    return () => { alive = false; };
  }, [docs, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  if (lang === 'ko' || !docs) return docs;
  return docs.map(d => (d && done[d.id]) || d);
}
