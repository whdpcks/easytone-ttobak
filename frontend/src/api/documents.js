/* D 담당 API — 토큰 첨부·오류 처리는 A의 api 모듈이 합니다. */
import { api } from './client';

/** 보관함 목록  GET /documents?category=xxx */
export function getDocuments({ category } = {}) {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  return api.get(`/documents${qs}`);
}

/** 문서 단건  GET /documents/:id — C의 결과 API (분석 중 409, 없으면 404) */
export function getDocument(id) {
  return api.get(`/documents/${id}`);
}

/** AI 검색  GET /search?q=xxx  → [{id, reason, doc}] */
export function searchDocuments(q) {
  return api.get(`/search?q=${encodeURIComponent(q)}`);
}
