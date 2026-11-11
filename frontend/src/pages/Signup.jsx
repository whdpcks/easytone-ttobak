/* 회원가입 (A) — 한 화면: 사용할 말 · 글씨 크기 · 목소리 빠르기 · 이름 · 전화번호 인증
   고르는 즉시 앱에 적용됩니다. 말을 바꾸면 화면 글자와 목소리가 바로 그 말로 바뀝니다. */
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ChoiceSheet from '../common/ChoiceSheet';
import Header from '../common/Header';
import PhoneVerify from '../common/PhoneVerify';
import { LANGS, RATES, SCALES, useSettings } from '../common/SettingsContext';
import { useUI } from '../common/UIContext';
import { errorText, useT } from '../common/i18n';
import useVoice from '../hooks/useVoice';
import Icon from '../utils/icons';
import { signup } from '../api/auth';

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, setLang, scale, setScale, rate, setRate, setUser } = useSettings();
  const { toast } = useUI();
  const t = useT();

  const [langOpen, setLangOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(location.state?.phone || '');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const voiceText = t('signup.voice');
  const { speak } = useVoice(voiceText);   // 말을 바꾸면 문장이 바뀌어서 새 말로 다시 읽음

  const fail = (msg, e) => {
    const text = e ? errorText(t, e) : msg;
    setError(text);
    if (text) speak(text);
  };

  const pickRate = (r) => {
    setRate(r.value);
    setTimeout(() => speak(t('rate.sample', { x: t(`rate.${r.value}`) })), 0);
  };

  const submit = async (c = code) => {
    if (busy) return;
    if (!name.trim()) { fail(t('err.name')); return; }
    if (c.length !== 6) { fail(t('err.code6')); return; }
    setBusy(true);
    setError('');
    try {
      const user = await signup({
        name: name.trim(), phone, code: c, language: lang, font_scale: scale, voice_rate: rate,
      });
      setUser(user);
      toast(t('signup.welcome', { name: user.name }));
      navigate('/home', { replace: true });
    } catch (e) {
      if (e.status === 409) {
        toast(t('err.registered'));
        navigate('/login', { state: { phone }, replace: true });
      } else {
        fail('', e);
      }
    } finally {
      setBusy(false);
    }
  };

  const onPhoneError = (msg, e) => {
    if (e?.status === 409) {
      toast(t('err.registered'));
      navigate('/login', { state: { phone }, replace: true });
      return;
    }
    fail(msg, e);
  };

  const curLang = LANGS.find(l => l.value === lang) ?? LANGS[0];

  return (
    <div className="app">
      <Header left="back" title={t('signup.title')} voiceText={voiceText} />
      <form className="body" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div>
          <h1 className="h">{t('signup.h')}</h1>
          <p className="sub">{t('signup.sub')}</p>
        </div>

        {/* 사용할 말 — 외국인도 알아보게 'Language'를 같이 씀 */}
        <div className="field">
          <span className="lbl">{t('signup.lang')}{lang !== 'en' && <span className="lbl-en"> · Language</span>}</span>
          <button type="button" className="picker" onClick={() => setLangOpen(true)} aria-haspopup="dialog">
            <Icon name="globe" />
            <b lang={curLang.value}>{curLang.label}</b>
            <Icon name="chev" className="chev" />
          </button>
        </div>

        <div className="field" role="group" aria-labelledby="scale-lbl">
          <span className="lbl" id="scale-lbl">{t('signup.font')}</span>
          <div className="seg">
            {SCALES.map(s => (
              <button
                type="button" key={s.value} aria-pressed={scale === s.value}
                onClick={() => { setScale(s.value); speak(t('font.changed', { x: t(`font.${s.value}`) })); }}
              >
                <span className="gg" aria-hidden="true" style={{ fontSize: `${0.9 + (s.value - 1) * 1.6}em` }}>가</span>
                <span>{t(`font.${s.value}`)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field" role="group" aria-labelledby="rate-lbl">
          <span className="lbl" id="rate-lbl">{t('signup.rate')}</span>
          <div className="seg">
            {RATES.map(r => (
              <button type="button" key={r.value} aria-pressed={rate === r.value} onClick={() => pickRate(r)}>
                <Icon name="speaker" />
                <span>{t(`rate.${r.value}`)}</span>
              </button>
            ))}
          </div>
          <span className="hint">{t('signup.rateHint')}</span>
        </div>

        <hr className="rule" />

        <div className="field">
          <label htmlFor="name">{t('signup.name')}</label>
          <input id="name" autoComplete="name" value={name} maxLength={30}
            onChange={(e) => setName(e.target.value)} disabled={busy} />
        </div>

        <PhoneVerify
          purpose="signup" phone={phone} setPhone={setPhone} code={code} setCode={setCode}
          onSent={() => setSent(true)} onComplete={submit} onError={onPhoneError} disabled={busy}
        />

        {error && <p className="err" role="alert">{error}</p>}

        {sent && (
          <button className="btn red" type="submit" disabled={busy || code.length !== 6}>
            {busy ? t('signup.busy') : t('signup.btn')}
          </button>
        )}
      </form>

      {langOpen && (
        <ChoiceSheet
          title={`${t('signup.lang')} · Language`} options={LANGS} value={lang}
          onPick={(o) => setLang(o.value)} sub={(o) => o.ko} onClose={() => setLangOpen(false)}
        />
      )}
    </div>
  );
}
