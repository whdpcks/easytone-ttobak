/* 전화번호 + 문자 인증 (A 담당) — 로그인·회원가입에서 같이 씁니다.
   <PhoneVerify purpose="login" phone={phone} setPhone={setPhone}
                code={code} setCode={setCode} onComplete={(code) => ...} onSent={...} onError={...} /> */
import { useEffect, useRef, useState } from 'react';
import { sendCode } from '../api/auth';
import SmsBanner from './SmsBanner';
import { useVoiceContext } from './VoiceContext';

export function formatPhone(raw) {
  const d = String(raw ?? '').replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
}
export const isPhone = (v) => /^01\d{8,9}$/.test(String(v ?? '').replace(/\D/g, ''));
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function PhoneVerify({
  purpose, phone, setPhone, code, setCode, onComplete, onSent, onError, disabled = false,
}) {
  const { speak } = useVoiceContext();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);        // 인증번호 남은 시간(초)
  const [resendIn, setResendIn] = useState(0);
  const [banner, setBanner] = useState('');
  const codeRef = useRef(null);

  useEffect(() => {
    if (!sent) return undefined;
    const t = setInterval(() => {
      setLeft(v => Math.max(0, v - 1));
      setResendIn(v => Math.max(0, v - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [sent]);

  const request = async () => {
    if (!isPhone(phone)) { onError?.('전화번호를 다시 확인해 주세요.'); return; }
    setBusy(true);
    onError?.('');
    try {
      const res = await sendCode(phone, purpose);
      setSent(true);
      setCode('');
      setLeft(res.expires_in ?? 180);
      setResendIn(res.resend_in ?? 20);
      onSent?.();
      speak('문자로 인증번호를 보냈어요. 문자에 있는 숫자 여섯 개를 넣어 주세요.');
      setTimeout(() => codeRef.current?.focus(), 50);
      // 데모 모드: 실제 문자 대신 1.2초 뒤 "문자 알림"
      if (res.demo_code) setTimeout(() => setBanner(res.demo_code), 1200);
    } catch (e) {
      onError?.(e.message, e);
    } finally {
      setBusy(false);
    }
  };

  const changeCode = (v) => {
    const c = v.replace(/\D/g, '').slice(0, 6);
    setCode(c);
    if (c.length === 6) onComplete?.(c);
  };

  return (
    <>
      <div className="field">
        <label htmlFor={`phone-${purpose}`}>전화번호</label>
        <input
          id={`phone-${purpose}`} inputMode="tel" autoComplete="tel" placeholder="010-0000-0000"
          value={phone} disabled={disabled}
          onChange={(e) => { setPhone(formatPhone(e.target.value)); if (sent) setSent(false); }}
        />
      </div>

      {!sent && (
        <button type="button" className="btn primary" onClick={request} disabled={busy || disabled}>
          {busy ? '보내는 중…' : '인증번호 받기'}
        </button>
      )}

      {sent && (
        <div className="field">
          <div className="lbl-row">
            <label htmlFor={`code-${purpose}`}>문자로 온 인증번호</label>
            <span className={`timer${left <= 30 ? ' warn' : ''}`} aria-live="off">
              {left > 0 ? mmss(left) : '시간 지남'}
            </span>
          </div>
          <input
            ref={codeRef} id={`code-${purpose}`} className="code-input"
            inputMode="numeric" autoComplete="one-time-code" placeholder="숫자 6개" maxLength={6}
            value={code} disabled={disabled} onChange={(e) => changeCode(e.target.value)}
          />
          <div className="lbl-row">
            <span className="hint">문자가 안 왔나요?</span>
            <button type="button" className="link" onClick={request} disabled={busy || resendIn > 0 || disabled}>
              {resendIn > 0 ? `${resendIn}초 뒤 다시 받기` : '다시 받기'}
            </button>
          </div>
        </div>
      )}

      {banner && (
        <SmsBanner
          code={banner}
          onUse={(c) => { setCode(c); onComplete?.(c); }}
          onClose={() => setBanner('')}
        />
      )}
    </>
  );
}
