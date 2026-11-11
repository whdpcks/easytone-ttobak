/* API 호출 모듈 — 토큰은 A가 localStorage에 'ttobak-token'으로 저장한다고 가정 */
const BASE = '/api';

function authHeaders() {
  const token = localStorage.getItem('ttobak-token') || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ── D 담당 API ── */

/** 보관함 목록  GET /documents?category=xxx */
export async function getDocuments({ category } = {}) {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  return request(`/documents${qs}`);
}

/** 문서 단건  GET /documents/:id */
export async function getDocument(id) {
  return request(`/documents/${id}`);
}

/** AI 검색  GET /search?q=xxx  → [{id, reason}] with doc populated */
export async function searchDocuments(q) {
  const raw = await request(`/search?q=${encodeURIComponent(q)}`);
  /* 서버가 [{id, reason}] 반환 → 각 doc 정보를 별도 fetch하거나
     서버에서 doc 포함해서 내려주면 그대로 사용 */
  if (raw.length === 0) return [];
  if (raw[0].doc) return raw; // 서버가 이미 doc 포함

  /* fallback: id 목록으로 개별 fetch */
  const docs = await Promise.allSettled(raw.map(r => getDocument(r.id)));
  return raw.map((r, i) => ({
    ...r,
    doc: docs[i].status === 'fulfilled' ? docs[i].value : null,
  }));
}
