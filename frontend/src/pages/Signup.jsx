/* 회원가입 (A) — 4단계: 사용할 말 → 글씨 크기 → 목소리 빠르기 → 이름·전화번호 인증
   고르는 즉시 앱에 적용돼서, 바뀐 글씨·목소리를 바로 보고 들을 수 있습니다. */
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../common/Header';
import PhoneVerify from '../common/PhoneVerify';
import { LANGS, RATES, SCALES, useSettings } from '../common/SettingsContext';
import { useUI } from '../common/UIContext';
import useVoice from '../hooks/useVoice';
import Icon from '../utils/icons';
import { signup } from '../api/auth';

const STEPS = [
  { key: 'lang', title: '어떤 말이 편하세요?', voice: '처음 오셨군요. 먼저 편한 말을 골라주세요.' },
  { key: 'scale', title: '글씨 크기를 골라주세요', voice: '글씨 크기를 골라주세요. 누르면 바로 바뀌어요.' },
  { key: 'rate', title: '목소리 빠르기를 골라주세요', voice: '목소리 빠르기를 골라주세요. 누르면 그 빠르기로 들려드려요.' },
  { key: 'me', title: '이름과 전화번호를 넣어주세요', voice: '이름과 전화번호를 넣고, 문자로 온 인증번호를 넣어주세요.' },
];
const PREVIEW = { 1: 1.2, 1.25: 1.5, 1.5: 1.8 };

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, setLang, scale, setScale, rate, setRate, setUser } = useSettings();
  const { toast } = useUI();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(location.state?.phone || '');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const cur = STEPS[step];
  const { speak } = useVoice(cur.voice);
  const fail = (msg) => { setError(msg); if (msg) speak(msg); };

  const back = () => {
    setError('');
    if (step > 0) setStep(step - 1);
    else navigate(-1);
  };
  const next = () => { setError(''); setStep(step + 1); };

  const pickLang = (l) => {
    setLang(l.value);
    speak(l.value === 'ko' ? '한국어를 골랐어요.' : `${l.ko}를 골랐어요. 안내는 지금 한국어로 나와요.`);
  };
  const pickRate = (r) => {
    setRate(r.value);
    setTimeout(() => speak(`${r.label}. 이 빠르기로 읽어드릴게요.`), 0);
  };

  const submit = async (c = code) => {
    if (busy) return;
    if (!name.trim()) { fail('이름을 넣어 주세요.'); return; }
    if (c.length !== 6) { fail('인증번호 숫자 여섯 개를 넣어 주세요.'); return; }
    setBusy(true);
    setError('');
    try {
      const user = await signup({
        name: name.trim(), phone, code: c, language: lang, font_scale: scale, voice_rate: rate,
      });
      setUser(user);
      toast(`${user.name} 님, 환영해요.`);
      navigate('/home', { replace: true });
    } catch (e) {
      if (e.status === 409) {
        toast('이미 가입한 번호예요. 로그인해 주세요.');
        navigate('/login', { state: { phone }, replace: true });
      } else {
        fail(e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const onPhoneError = (msg, e) => {
    if (e?.status === 409) {
      toast('이미 가입한 번호예요. 로그인해 주세요.');
      navigate('/login', { state: { phone }, replace: true });
      return;
    }
    fail(msg);
  };

  return (
    <div className="app">
      <Header left="back" onLeft={back} title="회원가입" voiceText={cur.voice} />
      <form className="body" onSubmit={(e) => { e.preventDefault(); step < 3 ? next() : submit(); }}>
        <div className="steps" aria-label={`${STEPS.length}단계 중 ${step + 1}단계`}>
          {STEPS.map((s, i) => <i key={s.key} className={i <= step ? 'on' : ''} />)}
          <span>{step + 1} / {STEPS.length}</span>
        </div>

        {step === 0 && <p className="eyebrow">처음 오셨군요</p>}
        <h1 className="h">{cur.title}</h1>

        {cur.key === 'lang' && (
          <div className="langs" role="radiogroup" aria-label="사용할 말">
            {LANGS.map(l => (
              <button
                type="button" key={l.value} role="radio" aria-checked={lang === l.value}
                className="lang" onClick={() => pickLang(l)}
              >
                <b lang={l.value}>{l.label}</b>
                <small>{l.ko}</small>
              </button>
            ))}
          </div>
        )}

        {cur.key === 'scale' && (
          <>
            <div className="sizes" role="radiogroup" aria-label="글씨 크기">
              {SCALES.map(s => (
                <button
                  type="button" key={s.value} role="radio" aria-checked={scale === s.value} aria-pressed={scale === s.value}
                  onClick={() => { setScale(s.value); speak(`${s.label}로 바꿨어요.`); }}
                >
                  <span className="gg" aria-hidden="true" style={{ fontSize: `${PREVIEW[s.value]}em` }}>가</span>
                  <b style={{ fontSize: `${s.value}em` }}>{s.label}</b>
                  {scale === s.value && <Icon name="check" className="ck" />}
                </button>
              ))}
            </div>
            <div className="card preview">
              <small>이렇게 보여요</small>
              <p>건강검진은 11월 20일 오전 9시예요. 신분증을 꼭 가져가세요.</p>
            </div>
          </>
        )}

        {cur.key === 'rate' && (
          <div className="sizes" role="radiogroup" aria-label="목소리 빠르기">
            {RATES.map(r => (
              <button
                type="button" key={r.value} role="radio" aria-checked={rate === r.value} aria-pressed={rate === r.value}
                onClick={() => pickRate(r)}
              >
                <Icon name="speaker" className="gi" />
                <b>{r.label}</b>
                {rate === r.value && <Icon name="check" className="ck" />}
              </button>
            ))}
          </div>
        )}

        {cur.key === 'me' && (
          <>
            <div className="field">
              <label htmlFor="name">이름</label>
              <input id="name" autoComplete="name" value={name} maxLength={30}
                onChange={(e) => setName(e.target.value)} disabled={busy} />
            </div>
            <PhoneVerify
              purpose="signup" phone={phone} setPhone={setPhone} code={code} setCode={setCode}
              onSent={() => setSent(true)} onComplete={submit} onError={onPhoneError} disabled={busy}
            />
          </>
        )}

        {error && <p className="err" role="alert">{error}</p>}

        <div className="grow" />
        {step < 3 && <button className="btn primary" type="submit">다음</button>}
        {step === 3 && sent && (
          <button className="btn red" type="submit" disabled={busy || code.length !== 6}>
            {busy ? '가입하는 중…' : '가입하기'}
          </button>
        )}
      </form>
    </div>
  );
}
