/* 회원가입 (A) — 이름, 전화번호, 사용할 말, 글씨 크기 */
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../common/Header';
import { LANGS, SCALES, useSettings } from '../common/SettingsContext';
import { useUI } from '../common/UIContext';
import useVoice from '../hooks/useVoice';
import { signup } from '../api/auth';
import { formatPhone, isPhone } from './Login';

const VOICE = '회원가입 화면이에요. 이름과 전화번호를 넣고, 글씨 크기를 골라주세요.';

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, setLang, scale, setScale, setUser } = useSettings();
  const { toast } = useUI();
  const { speak } = useVoice(VOICE);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState(location.state?.phone || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const fail = (msg) => { setError(msg); speak(msg); };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return fail('이름을 넣어 주세요.');
    if (!isPhone(phone)) return fail('전화번호를 다시 확인해 주세요.');
    setBusy(true);
    setError('');
    try {
      const user = await signup({ name: name.trim(), phone, language: lang, font_scale: scale });
      setUser(user);
      toast(`${user.name} 님, 환영해요.`);
      navigate('/home', { replace: true });
    } catch (err) {
      if (err.status === 409) {
        toast('이미 가입한 번호예요. 로그인해 주세요.');
        navigate('/login', { state: { phone }, replace: true });
      } else {
        fail(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <Header left="back" title="회원가입" voiceText={VOICE} />
      <form className="body" onSubmit={submit}>
        <h1 className="h">처음 오셨군요</h1>

        <div className="field">
          <label htmlFor="name">이름</label>
          <input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
        </div>

        <div className="field">
          <label htmlFor="phone2">전화번호</label>
          <input
            id="phone2" inputMode="tel" autoComplete="tel" placeholder="010-0000-0000"
            value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))}
          />
        </div>

        <div className="field">
          <label htmlFor="lang">사용할 말</label>
          <select id="lang" value={lang} onChange={(e) => setLang(e.target.value)}>
            {LANGS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>

        <div className="field" role="group" aria-labelledby="scale-lbl">
          <span className="lbl" id="scale-lbl">글씨 크기</span>
          <div className="chips three">
            {SCALES.map(s => (
              <button
                type="button" key={s.value} className="chip" aria-pressed={scale === s.value}
                onClick={() => { setScale(s.value); speak(`${s.label}로 바꿨어요.`); }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <span className="hint">누르면 바로 글씨가 바뀌어요.</span>
        </div>

        {error && <p className="field err" role="alert">{error}</p>}

        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? '가입하는 중…' : '가입하기'}
        </button>
      </form>
    </div>
  );
}
