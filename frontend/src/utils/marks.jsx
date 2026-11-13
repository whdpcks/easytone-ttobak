/* 강조 표시 — 중요한 곳을 굵게 하고, 낱말이 하나씩 아래에서 떠오르게 (index.css의 .mark .rise)
   <Mark delay={60}>…</Mark>           : 감싼 글을 통째로 (delay는 화면에 들어온 뒤 ms)
   markNumbers(text, clock)           : 날짜·시간·금액처럼 숫자가 든 곳만 차례로
     clock = { t: 시작 ms } — 앞 덩어리가 다 떠오른 뒤 다음 덩어리가 이어지도록 t를 늘려 감.
     여러 줄에 같은 clock을 넘기면 줄을 넘어 순서대로 떠오름 */

const WORD_GAP = 45;    // 낱말 사이 간격(ms) — 한 덩어리는 거의 함께 떠오름
const PIECE_GAP = 260;  // 덩어리 사이 간격(ms)

const wordCount = text => text.split(/\s+/).filter(Boolean).length;

/* 통째로 강조할 때 clock도 함께 늘리기 */
export function markAll(text, clock) {
  const el = <Mark delay={clock.t}>{text}</Mark>;
  clock.t += wordCount(text) * WORD_GAP + PIECE_GAP;
  return el;
}

export function Mark({ delay = 0, children, after = '' }) {
  // 띄어쓰기에서 나눠 낱말마다 떠오르게 함 — 띄어쓰기는 그대로 둬서 줄바꿈이 원래대로 됨
  const parts = typeof children === 'string' ? children.split(/(\s+)/) : [children];
  const words = parts.filter(p => !(typeof p === 'string' && /^\s*$/.test(p))).length;
  let n = 0;
  return (
    <span className="mark">
      {parts.map((part, i) => {
        if (typeof part === 'string' && /^\s*$/.test(part)) return part;
        const rise = <span key={i} className="rise" style={{ '--d': `${delay + WORD_GAP * n}ms` }}>{part}</span>;
        n += 1;
        // 마지막 낱말은 바로 뒤 글자('08:30' + '부터')와 붙여 둠 — 따로 줄이 바뀌지 않게
        return n === words && after
          ? <span key={i} className="glue">{rise}<span className="after">{after}</span></span>
          : rise;
      })}
    </span>
  );
}

const AMPM = '(?:오전|오후|새벽|저녁|午前|午後|上午|下午|中午|晚上)';
const MONTH = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?';
const UNIT = '(?:[년월일시분초원개명장번층호세살회月日時时点分秒円元号個个名枚歳岁回次]|만\\s?원|천\\s?원|억|만|천|AM|PM|am|pm|a\\.m\\.|p\\.m\\.|%|won|KRW|yen|yuan|days?|hours?|minutes?)';
const NUM = `(?:${MONTH}\\s)?\\d[\\d,.:]*(?:\\s?${UNIT})*`;
const PART = `(?:${AMPM}\\s?)?${NUM}`;
// '11월 20일 오후 2시', '9:30~11:00', '30,000원'처럼 이어진 숫자 덩어리는 한 번에
const NUMBERS = new RegExp(`${PART}(?:[\\s~\\-–(),]*(?:\\([^)\\d]{1,3}\\)\\s?)?${PART})*`, 'gu');

export function markNumbers(text, clock = { t: 0 }) {
  if (!text) return text;
  const out = [];
  let last = 0;
  for (const m of text.matchAll(NUMBERS)) {
    const piece = m[0].trimEnd();
    if (/^\d+$/.test(piece)) continue;  // '2학년 8반'의 2·8처럼 단위 없는 숫자는 그대로 둠
    if (m.index > last) out.push(text.slice(last, m.index));
    const end = m.index + piece.length;
    const after = /\S/u.test(text[end] ?? '') ? text[end] : '';
    out.push(<Mark key={m.index} delay={clock.t} after={after}>{piece}</Mark>);
    clock.t += wordCount(piece) * WORD_GAP + PIECE_GAP;
    last = end + after.length;
  }
  if (last === 0) return text;
  out.push(text.slice(last));
  return out;
}
