/* C 규격: date "YYYY-MM-DD", time "HH:MM" (24시간)
   lang은 A 설정의 사용할 말(ko, en, zh …). 한국어는 시안 그대로, 다른 말은 그 나라 날짜 표기. */
const BCP47 = { ko: 'ko-KR', en: 'en-US', zh: 'zh-CN', ja: 'ja-JP', vi: 'vi-VN', th: 'th-TH', id: 'id-ID', fil: 'fil-PH', km: 'km-KH', my: 'my-MM', hi: 'hi-IN', ne: 'ne-NP' };
const locale = (lang) => BCP47[lang] || 'ko-KR';
const fmt = (lang, date, opts) => {
  try { return new Intl.DateTimeFormat(locale(lang), opts).format(date); }
  catch { return new Intl.DateTimeFormat('en-US', opts).format(date); }
};

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysUntil(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date - today) / 86400000);
}

/* "오전 9시" / "9:00 AM" */
export function formatTime(t, lang = 'ko') {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (lang === 'ko') return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시${m ? ` ${m}분` : ''}`;
  return fmt(lang, new Date(2000, 0, 1, h, m), { hour: 'numeric', minute: '2-digit' });
}

/* "11월 20일 금요일" / "Friday, November 20" */
export function formatDay(s, lang = 'ko') {
  const d = parseDate(s);
  if (lang === 'ko') return `${d.getMonth() + 1}월 ${d.getDate()}일 ${d.toLocaleDateString('ko-KR', { weekday: 'long' })}`;
  return fmt(lang, d, { month: 'long', day: 'numeric', weekday: 'long' });
}

/* 음성용 "11월 20일" / "November 20" */
export function formatMonthDay(date, lang = 'ko') {
  if (lang === 'ko') return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  return fmt(lang, date, { month: 'long', day: 'numeric' });
}

/* 달력 칸 위: "11월" / "Nov" */
export function formatMonthShort(date, lang = 'ko') {
  if (lang === 'ko') return `${date.getMonth() + 1}월`;
  return fmt(lang, date, { month: 'short' });
}

/* 달력 칸 아래: "금" / "Fri" */
export function formatWeekdayShort(date, lang = 'ko') {
  return fmt(lang, date, { weekday: 'short' });
}

/* 달력 칸 아래 요일을 두 조각으로: ['금', '요일'] / ['金', '曜日'] — 앞만 굵게 쓰려고.
   한국어·일본어만 '요일'을 붙이고, 그 외는 짧은 이름 하나 ('Fri', '周五') */
export function formatWeekdayParts(date, lang = 'ko') {
  const short = formatWeekdayShort(date, lang);
  if (lang === 'ko') return [short, '요일'];
  if (lang === 'ja') return [short, '曜日'];
  return [short, ''];
}

/* 알림 달력 위: "2026년 11월" / "November 2026" */
export function formatYearMonth(date, lang = 'ko') {
  if (lang === 'ko') return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
  return fmt(lang, date, { year: 'numeric', month: 'long' });
}

/* 알림 달력 머리줄: 일요일부터 ["일", "월", …] / ["Sun", "Mon", …] */
export function weekdayNames(lang = 'ko') {
  // 2026-11-01은 일요일
  return Array.from({ length: 7 }, (_, i) => fmt(lang, new Date(2026, 10, 1 + i), { weekday: 'short' }));
}
