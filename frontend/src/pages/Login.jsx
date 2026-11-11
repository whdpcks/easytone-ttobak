/* 로그인 (A) — 전화번호 + 인증번호(시연용 000000 고정) */
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../common/Header';
import { useSettings } from '../common/SettingsContext';
import { useUI } from '../common/UIContext';
import useVoice from '../hooks/useVoice';
import { DEMO_CODE, DEMO_PHONE, login } from '../api/auth';

export function formatPhone(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
}
export const isPhone = (v) => /^01\d{8,9}$/.test(v.replace(/\D/g, ''));

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useSettings();
  const { toast } = useUI();

  const [phone, setPhone] = useState(location.state?.phone || '');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const voiceText = sent
    ? '인증번호를 넣고 로그인을 눌러주세요. 시연용 인증번호는 공 여섯 개예요.'
    : '로그인 화면이에요. 전화번호를 넣고 인증번호 받기를 눌러주세요.';
  const { speak } = useVoice(voiceText);

  const fail = (msg) => { setError(msg); speak(msg); };

  const sendCode = () => {
    if (!isPhone(phone)) return fail('전화번호를 다시 확인해 주세요.');
    setError('');
    setSent(true);
    setCode(DEMO_CODE);   // 시연: 문자 대신 자동 입력
  };

  const doLogin = async (p = phone, c = code) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const user = await login(p, c);
      setUser(user);
      toast(`${user.name} 님, 반가워요.`);
      navigate(location.state?.from || '/home', { replace: true });
    } catch (e) {
      if (e.status === 404) {
        toast('처음이시네요. 회원가입을 해 주세요.');
        navigate('/signup', { state: { phone: p } });
      } else {
        fail(e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <Header left="back" title="로그인" voiceText={voiceText} />
      <main className="body">
        <h1 className="h">전화번호로<br />들어오세요</h1>
        <p className="sub">비밀번호는 필요 없어요.</p>

        <form
          style={{ display: 'contents' }}
          onSubmit={(e) => { e.preventDefault(); sent ? doLogin() : sendCode(); }}
        >
          <div className="field">
            <label htmlFor="phone">전화번호</label>
            <input
              id="phone" inputMode="tel" autoComplete="tel" placeholder="010-0000-0000"
              value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))}
            />
          </div>

          {sent && (
            <div className="field">
              <label htmlFor="code">문자로 온 인증번호</label>
              <input
                id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
              <span className="hint">시연용 인증번호는 000000이에요.</span>
            </div>
          )}

          {error && <p className="field err" role="alert">{error}</p>}

          <button className="btn primary" type="submit" disabled={busy}>
            {sent ? (busy ? '들어가는 중…' : '로그인') : '인증번호 받기'}
          </button>
        </form>

        <button className="btn line" onClick={() => doLogin(DEMO_PHONE, DEMO_CODE)} disabled={busy}>
          간편 로그인
        </button>
        <button className="btn ghost" onClick={() => navigate('/signup', { state: { phone } })}>
          처음이세요? 회원가입
        </button>
      </main>
    </div>
  );
}
