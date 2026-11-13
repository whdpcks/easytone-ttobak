/* D 담당 API — 토큰 첨부·오류 처리는 A의 api 모듈이 합니다. */
import { api } from './client';

const langQs = (lang) => (lang && lang !== 'ko' ? `lang=${encodeURIComponent(lang)}` : '');

/** 보관함 목록  GET /documents?category=xxx&lang=xx
    lang을 주면 C가 이미 번역해 둔 문서는 번역본(doc.lang === lang)으로 옵니다. */
export function getDocuments({ category, lang } = {}) {
  const qs = [category && `category=${encodeURIComponent(category)}`, langQs(lang)].filter(Boolean).join('&');
  return api.get(`/documents${qs ? `?${qs}` : ''}`);
}

/** 문서 한 건 — C의 결과 API (분석 중 409, 없으면 404)
    한국어: GET /documents/:id
    그 외:  GET /documents/:id/translation?lang=xx  (C가 번역, 서버에 캐시. 실패하면 503) */
export function getDocument(id, lang = 'ko') {
  return lang && lang !== 'ko'
    ? api.get(`/documents/${id}/translation?${langQs(lang)}`)
    : api.get(`/documents/${id}`);
}

/** AI 검색  GET /search?q=xxx&lang=xx  → [{id, reason, doc}]  (이유는 그 언어로) */
export function searchDocuments(q, lang = 'ko') {
  const qs = [`q=${encodeURIComponent(q)}`, langQs(lang)].filter(Boolean).join('&');
  return api.get(`/search?${qs}`);
}
