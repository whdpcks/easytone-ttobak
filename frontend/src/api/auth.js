/* A 담당 API: 로그인 · 회원가입 · 내 정보 */
import { api, clearToken, setToken } from './client';

export const DEMO_PHONE = '010-1234-5678';
export const DEMO_CODE = '000000';

export async function login(phone, code) {
  const res = await api.post('/auth/login', { phone, code }, { auth: false });
  setToken(res.token);
  return res.user;
}

export async function signup({ name, phone, language, font_scale }) {
  const res = await api.post('/auth/signup', { name, phone, language, font_scale }, { auth: false });
  setToken(res.token);
  return res.user;
}

export async function logout() {
  try { await api.post('/auth/logout'); } catch { /* 토큰이 이미 없어도 로그아웃 처리 */ }
  clearToken();
}

export const getMe = (opts) => api.get('/me', opts);
export const updateMe = (changes) => api.patch('/me', changes);
