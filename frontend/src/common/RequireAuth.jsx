/* 로그인해야 들어갈 수 있는 화면을 감쌉니다. 토큰이 없으면 시작 화면으로. */
import { Navigate, useLocation } from 'react-router-dom';
import { getToken } from '../api/client';
import { useSettings } from './SettingsContext';

export default function RequireAuth({ children }) {
  const { user, checking } = useSettings();
  const location = useLocation();

  if (!getToken()) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  // 로그인 확인 중 — "불러오는 중" 글자 없이 빈 화면 (금방 끝나서 글자가 깜빡이기만 함)
  if (checking && !user) return <div className="app" aria-busy="true" />;
  return children;
}
