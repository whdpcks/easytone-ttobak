/* 알림 받기 (D) — 그 달 달력을 아래에서 띄우고, 그날에 펜으로 동그라미를 그리듯 표시
   (실제 알림은 보내지 않는 보여주기용 화면. 모션은 index.css의 .remind-cal) */
import { useEffect } from 'react';
import Sheet from '../common/Sheet';
import { useT } from '../common/i18n';
import { useVoiceContext } from '../common/VoiceContext';
import { formatDay, formatTime, formatYearMonth, parseDate, weekdayNames } from '../utils/datetime';

export default function RemindSheet({ date, time, lang, onClose }) {
  const t = useT();
  const { speak } = useVoiceContext();
  const target = parseDate(date);
  const y = target.getFullYear();
  const m = target.getMonth();
  const today = new Date();
  const isThisMonth = today.getFullYear() === y && today.getMonth() === m;

  // 달력 칸: 1일 앞은 빈칸, 그 뒤로 1일 ~ 말일
  const blanks = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(blanks).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  const when = [formatDay(date, lang), formatTime(time, lang)].filter(Boolean).join(' ');
  const title = t('d.remindSet');
  const sub = t('d.remindWhen', { date: when });

  useEffect(() => { speak(`${title} ${sub}`); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet label={title} onDismiss={onClose}>
      <h2>{title}</h2>
      <div className="remind-cal">
        <b className="rc-month">{formatYearMonth(target, lang)}</b>
        <div className="rc-grid" aria-hidden="true">
          {weekdayNames(lang).map((w, i) => <span key={w} className={`rc-wd${i === 0 ? ' sun' : ''}`}>{w}</span>)}
          {cells.map((d, i) => {
            if (!d) return <span key={`b${i}`} />;
            const hit = d === target.getDate();
            const isToday = isThisMonth && d === today.getDate();
            return (
              <span key={d} className={`rc-day${hit ? ' hit' : ''}${isToday ? ' today' : ''}${i % 7 === 0 ? ' sun' : ''}`}>
                {d}
                {hit && (
                  <svg className="rc-ring" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* 손으로 그린 듯 살짝 비뚤고 끝이 겹치는 동그라미 */}
                    <path pathLength="1" d="M72 14C50 2 14 12 9 46c-4 30 22 48 48 46 28-2 40-24 34-48C86 22 66 8 42 10" />
                  </svg>
                )}
              </span>
            );
          })}
        </div>
      </div>
      <p className="sub rc-when">{sub}</p>
      <button className="btn primary" onClick={onClose}>{t('common.done')}</button>
    </Sheet>
  );
}
