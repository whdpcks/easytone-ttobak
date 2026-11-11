/* ─────────────────────────────────────────────
   토스트 · 확인 창 · 글씨 크기 시트 (A 담당)

   const { toast, confirm, openFontSheet } = useUI();
   toast('저장했어요');                         // 화면 아래 2.2초 + 음성
   const ok = await confirm({
     title: '찍은 종이를 버릴까요?',
     message: '3장을 찍었어요.',
     okText: '버리고 나가기', cancelText: '계속 찍기', danger: true,
   });
───────────────────────────────────────────── */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Sheet from './Sheet';
import FontSizeSheet from './FontSizeSheet';
import { useVoiceContext } from './VoiceContext';
import { useT } from './i18n';

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const { speak, replay } = useVoiceContext();
  const t = useT();
  const [toastText, setToastText] = useState('');
  const [dialog, setDialog] = useState(null);   // { title, message, okText, cancelText, danger, resolve }
  const [fontOpen, setFontOpen] = useState(false);
  const timer = useRef(null);

  const toast = useCallback((text, { voice = true } = {}) => {
    clearTimeout(timer.current);
    setToastText(text);
    if (voice) speak(text);
    timer.current = setTimeout(() => setToastText(''), 2200);
  }, [speak]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    setDialog({ okText: '네', cancelText: '아니요', ...opts, resolve });
    speak([opts.title, opts.message].filter(Boolean).join(' '));
  }), [speak]);

  const close = (answer) => {
    dialog?.resolve(answer);
    setDialog(null);
  };

  const openFontSheet = useCallback(() => {
    setFontOpen(true);
    speak(t('font.voice'));
  }, [speak, t]);
  const closeFontSheet = useCallback(() => {
    setFontOpen(false);
    replay();
  }, [replay]);

  const value = useMemo(() => ({ toast, confirm, openFontSheet }), [toast, confirm, openFontSheet]);

  return (
    <UIContext.Provider value={value}>
      {children}

      {fontOpen && <FontSizeSheet onClose={closeFontSheet} />}

      {dialog && (
        <Sheet label={dialog.title} onDismiss={() => close(false)}>
          <h2>{dialog.title}</h2>
          {dialog.message && <p className="sub">{dialog.message}</p>}
          <button className={`btn ${dialog.danger ? 'red' : 'primary'}`} onClick={() => close(true)} autoFocus>
            {dialog.okText}
          </button>
          <button className="btn line" onClick={() => close(false)}>{dialog.cancelText}</button>
        </Sheet>
      )}

      {toastText && <div className="toast" role="status">{toastText}</div>}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI는 UIProvider 안에서만 쓸 수 있어요.');
  return ctx;
}
