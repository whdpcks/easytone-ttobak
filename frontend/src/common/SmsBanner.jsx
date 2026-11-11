/* 시연용 "문자 알림" (A 담당)
   실제 문자를 보내지 않는 데모 모드에서, 휴대폰 위쪽에 문자가 온 것처럼 보여줍니다.
   누르면 인증번호가 자동으로 들어갑니다. */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from './i18n';

export default function SmsBanner({ code, onUse, onClose }) {
  const t = useT();
  const [leaving, setLeaving] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    setLeaving(false);
    const t1 = setTimeout(() => setLeaving(true), 8000);
    const t2 = setTimeout(() => closeRef.current(), 8400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [code]);

  return createPortal(
    <button
      type="button"
      className={`sms${leaving ? ' out' : ''}`}
      onClick={() => { onUse(code); onClose(); }}
      aria-label={`${t('sms.text', { code: code.split('').join(' ') })} ${t('sms.hint')}`}
    >
      <span className="sms-ic" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z" /></svg>
      </span>
      <span className="sms-body">
        <span className="sms-top"><b>{t('sms.app')}</b><small>{t('sms.now')}</small></span>
        <span className="sms-from">{t('sms.from')}</span>
        <span className="sms-text">{t('sms.text', { code })}</span>
        <span className="sms-hint">{t('sms.hint')}</span>
      </span>
    </button>,
    document.body,
  );
}
