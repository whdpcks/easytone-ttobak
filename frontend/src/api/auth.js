/* A 담당 API: 인증번호 · 로그인 · 회원가입 · 내 정보 · 가족 */
import { api, clearToken, setToken } from './client';

/** 인증번호 받기. 데모 모드면 { demo_code } 가 함께 옴 */
export const sendCode = (phone, purpose) =>
  api.post('/auth/send-code', { phone, purpose }, { auth: false });

export async function login(phone, code) {
  const res = await api.post('/auth/login', { phone, code }, { auth: false });
  setToken(res.token);
  return res.user;
}

export async function signup(body) {
  const res = await api.post('/auth/signup', body, { auth: false });
  setToken(res.token);
  return res.user;
}

/** 시연 계정으로 바로 들어가기 (서버에서 TTOBAK_DEMO_LOGIN=1 일 때만) */
export async function demoLogin() {
  const res = await api.post('/auth/demo-login', undefined, { auth: false });
  setToken(res.token);
  return res.user;
}

export async function logout() {
  try { await api.post('/auth/logout'); } catch { /* 토큰이 이미 없어도 로그아웃 처리 */ }
  clearToken();
}

export const getMe = (opts) => api.get('/me', opts);
export const updateMe = (changes) => api.patch('/me', changes);

export const getFamily = (opts) => api.get('/me/family', opts);
export const addFamily = (member) => api.post('/me/family', member);
export const removeFamily = (id) => api.del(`/me/family/${id}`);
