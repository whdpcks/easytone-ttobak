/* 로그인 (A) — 전화번호 + 문자 인증번호 */
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../common/Header';
import PhoneVerify from '../common/PhoneVerify';
import { useSettings } from '../common/SettingsContext';
import { useUI } from '../common/UIContext';
import useVoice from '../hooks/useVoice';
import { demoLogin, login } from '../api/auth';

export { formatPhone, isPhone } from '../common/PhoneVerify';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useSettings();
  const { toast } = useUI();

  const [phone, setPhone] = useState(location.state?.phone || '');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const voiceText = '로그인 화면이에요. 전화번호를 넣고 인증번호 받기를 눌러주세요.';
  const { speak } = useVoice(voiceText);

  const fail = (msg) => { setError(msg); if (msg) speak(msg); };

  const done = (user) => {
    setUser(user);
    toast(`${user.name} 님, 반가워요.`);
    navigate(location.state?.from || '/home', { replace: true });
  };

  const doLogin = async (c = code) => {
    if (busy) return;
    if (c.length !== 6) { fail('인증번호 숫자 여섯 개를 넣어 주세요.'); return; }
    setBusy(true);
    setError('');
    try {
      done(await login(phone, c));
    } catch (e) {
      fail(e.message);
    } finally {
      setBusy(false);
    }
  };

  const onPhoneError = (msg, e) => {
    if (e?.status === 404) {
      toast('처음이시네요. 회원가입을 해 주세요.');
      navigate('/signup', { state: { phone } });
      return;
    }
    fail(msg);
  };

  const tryDemo = async () => {
    setBusy(true);
    try { done(await demoLogin()); } catch (e) { fail(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="app">
      <Header left="back" title="로그인" voiceText={voiceText} />
      <form className="body" onSubmit={(e) => { e.preventDefault(); doLogin(); }}>
        <h1 className="h">전화번호로<br />들어오세요</h1>
        <p className="sub">비밀번호는 필요 없어요. 문자로 온 숫자만 넣으면 돼요.</p>

        <PhoneVerify
          purpose="login" phone={phone} setPhone={setPhone} code={code} setCode={setCode}
          onSent={() => setSent(true)} onComplete={doLogin} onError={onPhoneError} disabled={busy}
        />

        {error && <p className="err" role="alert">{error}</p>}

        {sent && (
          <button className="btn primary" type="submit" disabled={busy || code.length !== 6}>
            {busy ? '들어가는 중…' : '로그인'}
          </button>
        )}

        <div className="foot-links">
          <button type="button" className="btn line" onClick={() => navigate('/signup', { state: { phone } })}>
            처음이세요? 회원가입
          </button>
          <button type="button" className="btn ghost" onClick={tryDemo} disabled={busy}>
            시연 계정으로 둘러보기
          </button>
        </div>
      </form>
    </div>
  );
}
