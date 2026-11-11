/* 로그인 (A) — 전화번호 + 문자 인증번호 */
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../common/Header';
import PhoneVerify from '../common/PhoneVerify';
import { useSettings } from '../common/SettingsContext';
import { useUI } from '../common/UIContext';
import { errorText, useT } from '../common/i18n';
import useVoice from '../hooks/useVoice';
import { login } from '../api/auth';

export { formatPhone, isPhone } from '../common/PhoneVerify';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useSettings();
  const { toast } = useUI();
  const t = useT();

  const [phone, setPhone] = useState(location.state?.phone || '');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const voiceText = t('login.voice');
  const { speak } = useVoice(voiceText);

  const fail = (msg, e) => {
    const text = e ? errorText(t, e) : msg;
    setError(text);
    if (text) speak(text);
  };

  const doLogin = async (c = code) => {
    if (busy) return;
    if (c.length !== 6) { fail(t('err.code6')); return; }
    setBusy(true);
    setError('');
    try {
      const user = await login(phone, c);
      setUser(user);
      toast(t('login.welcome', { name: user.name }));
      navigate(location.state?.from || '/home', { replace: true });
    } catch (e) {
      fail('', e);
    } finally {
      setBusy(false);
    }
  };

  const onPhoneError = (msg, e) => {
    if (e?.status === 404) {
      toast(t('login.firstTime'));
      navigate('/signup', { state: { phone } });
      return;
    }
    fail(msg, e);
  };

  return (
    <div className="app">
      <Header left="back" title={t('login.title')} voiceText={voiceText} />
      <form className="body" onSubmit={(e) => { e.preventDefault(); doLogin(); }}>
        <h1 className="h pre">{t('login.h')}</h1>
        <p className="sub">{t('login.sub')}</p>

        <PhoneVerify
          purpose="login" phone={phone} setPhone={setPhone} code={code} setCode={setCode}
          onSent={() => setSent(true)} onComplete={doLogin} onError={onPhoneError} disabled={busy}
        />

        {error && <p className="err" role="alert">{error}</p>}

        {sent && (
          <button className="btn primary" type="submit" disabled={busy || code.length !== 6}>
            {busy ? t('login.busy') : t('login.btn')}
          </button>
        )}

        <div className="grow" />
        <button type="button" className="btn line" onClick={() => navigate('/signup', { state: { phone } })}>
          {t('login.toSignup')}
        </button>
      </form>
    </div>
  );
}
