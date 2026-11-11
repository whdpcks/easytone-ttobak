/* 글씨 크기 시트 — 보통·크게·아주 크게 (100/125/150%) */
import Icon from '../utils/icons';
import Sheet from './Sheet';
import { SCALES, useSettings } from './SettingsContext';
import { useVoiceContext } from './VoiceContext';

const PREVIEW = { 1: 1.2, 1.25: 1.5, 1.5: 1.8 };

export default function FontSizeSheet({ onClose }) {
  const { scale, setScale } = useSettings();
  const { speak } = useVoiceContext();

  return (
    <Sheet label="글씨 크기" onDismiss={onClose}>
      <h2>글씨 크기</h2>
      <div className="sizes">
        {SCALES.map(s => (
          <button
            key={s.value}
            aria-pressed={scale === s.value}
            onClick={() => { setScale(s.value); speak(`${s.label}로 바꿨어요.`); }}
          >
            <span className="gg" style={{ fontSize: `${PREVIEW[s.value]}em` }}>가</span>
            <b style={{ fontSize: `${s.value}em` }}>{s.label}</b>
            {scale === s.value && <Icon name="check" className="ck" />}
          </button>
        ))}
      </div>
      <button className="btn primary" onClick={onClose}>다 됐어요</button>
    </Sheet>
  );
}
