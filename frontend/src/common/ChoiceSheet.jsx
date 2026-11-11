/* 여러 개 중 하나 고르는 시트 (사용할 말, 목소리 빠르기 등) */
import Icon from '../utils/icons';
import Sheet from './Sheet';
import { useT } from './i18n';

export default function ChoiceSheet({ title, options, value, onPick, onClose, label = (o) => o.label, sub }) {
  const t = useT();
  return (
    <Sheet label={title} onDismiss={onClose}>
      <h2>{title}</h2>
      <div className={`sizes${options.length > 4 ? ' scroll' : ''}`} role="radiogroup" aria-label={title}>
        {options.map(o => (
          <button key={o.value} role="radio" aria-checked={value === o.value} aria-pressed={value === o.value} onClick={() => onPick(o)}>
            <span className="opt-tx">
              <b lang={o.value}>{label(o)}</b>
              {sub && <small>{sub(o)}</small>}
            </span>
            {value === o.value && <Icon name="check" className="ck" />}
          </button>
        ))}
      </div>
      <button className="btn primary" onClick={onClose}>{t('common.done')}</button>
    </Sheet>
  );
}
