/* ─────────────────────────────────────────────
   D 담당 — 원문 보기 (찍거나 올린 종이 그대로)

   const pages = usePages(docId);       null = 받는 중, [] = 원본 없음 (시연 샘플 문서 등)
   const { images, loading, failed } = useOriginalImages(docId, pages);
     images: 준비된 것부터 [{ key, url, w, h }]  (사진은 그대로, PDF는 페이지마다 사진으로)
     loading: 아직 남은 원본을 받는/그리는 중
───────────────────────────────────────────── */
import { useEffect, useState } from 'react';
import { getPageFile, getPages } from '../api/documents';
import { pdfToImages } from '../utils/pdfImages';

/* 원본 목록 기억 — 결과 화면 ↔ 원문 화면을 오갈 때 다시 받지 않게 */
const pagesCache = new Map();

export function forgetPages(docId) {
  pagesCache.delete(String(docId));
}

export function usePages(docId) {
  const key = String(docId);
  const [pages, setPages] = useState(() => pagesCache.get(key) ?? null);
  useEffect(() => {
    let alive = true;
    setPages(pagesCache.get(key) ?? null);
    getPages(key)
      .then(list => {
        const value = Array.isArray(list) ? list : [];
        pagesCache.set(key, value);
        if (alive) setPages(value);
      })
      .catch(() => { if (alive) setPages(prev => prev ?? []); });
    return () => { alive = false; };
  }, [key]);
  return pages;
}

export function useOriginalImages(docId, pages) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!pages?.length) { setImages([]); setLoading(!pages); return undefined; }
    let alive = true;
    const made = [];  // 화면을 떠나면 지울 사진 주소
    setImages([]);
    setLoading(true);
    setFailed(false);
    (async () => {
      try {
        const out = [];
        for (const page of pages) {
          const blob = await getPageFile(docId, page.id);
          if (!alive) return;  // 그사이 화면을 떠남
          if (page.kind === 'pdf') {
            const pdfPages = await pdfToImages(blob);
            if (!alive) { pdfPages.forEach(p => URL.revokeObjectURL(p.url)); return; }
            made.push(...pdfPages.map(p => p.url));
            pdfPages.forEach((p, i) => out.push({ key: `${page.id}-${i}`, ...p }));
          } else {
            const url = URL.createObjectURL(blob);
            made.push(url);
            out.push({ key: page.id, url, w: 0, h: 0 });
          }
          if (alive) setImages([...out]);  // 한 장씩 준비되는 대로 보여 줌
        }
      } catch {
        if (alive) setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      made.forEach(url => URL.revokeObjectURL(url));
    };
  }, [docId, pages]);

  return { images, loading, failed };
}
