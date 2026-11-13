/* 자막 바 (A 담당) — 지금 읽는 문장을 화면 아래에 글자로 보여줍니다.
   App에 한 번만 둡니다. 화면에서는 따로 쓸 필요 없음. */
import { useVoiceContext } from './VoiceContext';
import { useT } from './i18n';

export default function CaptionBar({ hidden = false }) {
  const { caption, speaking, unlocked, supported, muted } = useVoiceContext();
  const t = useT();
  if (hidden || !caption) return null;

  return (
    <div className={`caption${speaking ? ' on' : ''}`} aria-live="polite">
      <span className="wave" aria-hidden="true"><i /><i /><i /></span>
      <p>{caption}</p>
      {supported && !unlocked && !muted && <span className="tap">{t('caption.tap')}</span>}
    </div>
  );
}
