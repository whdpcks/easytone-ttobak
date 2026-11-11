/* 글씨 크기 시트 — 보통·크게·아주 크게 (100/125/150%) */
import Icon from '../utils/icons';
import Sheet from './Sheet';
import { SCALES, useSettings } from './SettingsContext';
import { useVoiceContext } from './VoiceContext';
import { useT } from './i18n';

const PREVIEW = { 1: 1.2, 1.25: 1.5, 1.5: 1.8 };

export default function FontSizeSheet({ onClose }) {
  const { scale, setScale } = useSettings();
  const { speak } = useVoiceContext();
  const t = useT();

  return (
    <Sheet label={t('font.title')} onDismiss={onClose}>
      <h2>{t('font.title')}</h2>
      <div className="sizes">
        {SCALES.map(s => (
          <button
            key={s.value}
            aria-pressed={scale === s.value}
            onClick={() => { setScale(s.value); speak(t('font.changed', { x: t(`font.${s.value}`) })); }}
          >
            <span className="gg" aria-hidden="true" style={{ fontSize: `${PREVIEW[s.value]}em` }}>가</span>
            <b style={{ fontSize: `${s.value}em` }}>{t(`font.${s.value}`)}</b>
            {scale === s.value && <Icon name="check" className="ck" />}
          </button>
        ))}
      </div>
      <button className="btn primary" onClick={onClose}>{t('common.done')}</button>
    </Sheet>
  );
}
