/* ─────────────────────────────────────────────
   API 호출 모듈 (A 담당) — 모든 담당이 이걸로 서버를 부릅니다.
   - 토큰을 자동으로 붙입니다 (localStorage 'ttobak-token').
   - 개발: Vite가 /api → localhost:8000 으로 넘깁니다.
   - 배포: VITE_API_BASE 에 백엔드 주소를 넣습니다. (예: https://ttobak-api.onrender.com)

   사용 예:
     import { api } from '../api/client';
     const doc  = await api.get(`/documents/${id}`, { signal });
     const { id } = await api.post('/documents');
     await api.upload(`/documents/${id}/pages`, { file: blob });   // multipart
───────────────────────────────────────────── */
import { STORAGE } from '../common/storageKeys';

export const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');

export function getToken() {
  try { return localStorage.getItem(STORAGE.token) || ''; } catch { return ''; }
}
export function setToken(token) {
  try { localStorage.setItem(STORAGE.token, token); } catch { /* 저장 불가 환경 */ }
}
export function clearToken() {
  try { localStorage.removeItem(STORAGE.token); } catch { /* 무시 */ }
}

export class ApiError extends Error {
  constructor(status, message, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

/* 서버 오류를 화면에 보여줄 쉬운 문장으로 */
function messageFrom(status, data) {
  const d = data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d[0]?.msg) {
    const m = String(d[0].msg).replace(/^Value error,\s*/, '');
    return /[가-힣]/.test(m) ? m : '입력한 내용을 다시 확인해 주세요.';
  }
  if (status === 401) return '다시 로그인해 주세요.';
  if (status >= 500) return '잠시 문제가 생겼어요. 조금 뒤 다시 해 주세요.';
  return '요청을 처리하지 못했어요.';
}

export async function request(path, { method = 'GET', body, headers, signal, auth = true } = {}) {
  const h = { ...(headers || {}) };
  const token = auth ? getToken() : '';
  if (token) h.Authorization = `Bearer ${token}`;

  let payload = body;
  if (body !== undefined && !(body instanceof FormData)) {
    h['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(API_BASE + path, { method, headers: h, body: payload, signal });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, '인터넷 연결을 확인해 주세요.');
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && token) {
      clearToken();
      window.dispatchEvent(new Event('ttobak:unauthorized'));
    }
    throw new ApiError(res.status, messageFrom(res.status, data), data?.detail);
  }
  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
  /** multipart 업로드: fields = { file: Blob, ... } */
  upload: (path, fields, opts) => {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    return request(path, { ...opts, method: 'POST', body: fd });
  },
};
