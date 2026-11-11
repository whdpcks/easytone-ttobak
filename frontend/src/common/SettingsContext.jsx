/* ─────────────────────────────────────────────
   설정 + 로그인 사용자 (A 담당)
   const { user, scale, setScale, rate, lang } = useSettings();

   글씨 크기는 <html style="--scale: 1.25"> 하나로 앱 전체에 적용됩니다.
   로그인 상태면 바꾼 값을 서버(PATCH /me)에도 저장합니다.
───────────────────────────────────────────── */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMe, updateMe } from '../api/auth';
import { clearToken, getToken } from '../api/client';
import { STORAGE, readStorage, writeStorage } from './storageKeys';

export const SCALES = [
  { value: 1, label: '보통' },
  { value: 1.25, label: '크게' },
  { value: 1.5, label: '아주 크게' },
];
export const RATES = [
  { value: 0.8, label: '천천히' },
  { value: 0.92, label: '보통' },
  { value: 1.05, label: '빠르게' },
];
export const LANGS = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
  { value: 'vi', label: 'Tiếng Việt' },
];

const pick = (list, v, fallback) => (list.some(x => x.value === v) ? v : fallback);
export const labelOf = (list, v) => list.find(x => x.value === v)?.label ?? '';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [scale, setScaleState] = useState(() => pick(SCALES, Number(readStorage(STORAGE.scale, 1)), 1));
  const [rate, setRateState] = useState(() => pick(RATES, Number(readStorage(STORAGE.rate, 0.92)), 0.92));
  const [lang, setLangState] = useState(() => pick(LANGS, readStorage(STORAGE.lang, 'ko'), 'ko'));
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(() => Boolean(getToken()));

  // 글씨 크기를 앱 전체에 적용
  useEffect(() => {
    document.documentElement.style.setProperty('--scale', String(scale));
  }, [scale]);

  // 서버에 저장된 설정으로 맞추기 (로그인·새로고침 시)
  const applyUser = useCallback((u) => {
    setUser(u);
    if (!u) return;
    const s = pick(SCALES, u.font_scale, null);
    const r = pick(RATES, u.voice_rate, null);
    const l = pick(LANGS, u.language, null);
    if (s !== null) { setScaleState(s); writeStorage(STORAGE.scale, s); }
    if (r !== null) { setRateState(r); writeStorage(STORAGE.rate, r); }
    if (l !== null) { setLangState(l); writeStorage(STORAGE.lang, l); }
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    const ctrl = new AbortController();
    getMe({ signal: ctrl.signal })
      .then(applyUser)
      .catch(e => { if (e.name !== 'AbortError' && e.status === 401) clearToken(); })
      .finally(() => setChecking(false));
    return () => ctrl.abort();
  }, [applyUser]);

  // 다른 곳에서 401을 받으면 로그아웃 상태로
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('ttobak:unauthorized', onUnauthorized);
    return () => window.removeEventListener('ttobak:unauthorized', onUnauthorized);
  }, []);

  const saveRemote = useCallback((changes) => {
    if (!getToken()) return;
    updateMe(changes).then(setUser).catch(() => { /* 화면 설정은 이미 바뀌었으니 조용히 무시 */ });
  }, []);

  const setScale = useCallback((v) => {
    setScaleState(v); writeStorage(STORAGE.scale, v); saveRemote({ font_scale: v });
  }, [saveRemote]);
  const setRate = useCallback((v) => {
    setRateState(v); writeStorage(STORAGE.rate, v); saveRemote({ voice_rate: v });
  }, [saveRemote]);
  const setLang = useCallback((v) => {
    setLangState(v); writeStorage(STORAGE.lang, v); saveRemote({ language: v });
  }, [saveRemote]);

  const value = useMemo(() => ({
    scale, setScale, rate, setRate, lang, setLang,
    user, setUser: applyUser, checking,
  }), [scale, setScale, rate, setRate, lang, setLang, user, applyUser, checking]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings는 SettingsProvider 안에서만 쓸 수 있어요.');
  return ctx;
}
