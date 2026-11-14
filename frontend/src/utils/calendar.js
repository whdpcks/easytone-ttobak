/* 알림 받기 (D) — 날짜·시간을 휴대폰 달력에 넣을 일정 파일(.ics)로 만들어 줌
   파일을 열면 달력 앱이 "일정 추가"를 띄우고, 넣어 두면 달력 앱이 미리 알려 줘요.
     - 시간이 있으면: 하루 전 + 1시간 전에 알림 (일정은 1시간짜리)
     - 하루 종일이면: 전날 아침 9시 + 당일 아침 9시에 알림
   서버·로그인 없이 휴대폰 달력의 알림을 그대로 씀 → 앱을 닫아도 알림이 옴 */

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const stamp = d => `${ymd(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

/* 일정 글자 안의 \ ; , 줄바꿈은 규칙대로 바꿔 씀 */
const esc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/* 한 줄이 75바이트를 넘으면 접어 씀 (규칙: 다음 줄은 띄어쓰기로 시작) — 한글은 한 글자 3바이트 */
const enc = new TextEncoder();
function fold(line) {
  const out = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > 73) { out.push(cur); cur = ' '; bytes = 1; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n');
}

/** date "YYYY-MM-DD", time "HH:MM" | null */
export function makeIcs({ title, date, time, note, location, uid }) {
  const [y, m, d] = date.split('-').map(Number);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ttobak//remind//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}@ttobak`,
    `DTSTAMP:${stamp(new Date())}`,
  ];
  let alarms;
  if (time) {
    const [hh, mm] = time.split(':').map(Number);
    const start = new Date(y, m - 1, d, hh, mm);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    lines.push(`DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`);  // 휴대폰 시간대 그대로
    alarms = ['-P1D', '-PT1H'];
  } else {
    const start = new Date(y, m - 1, d);
    const end = new Date(y, m - 1, d + 1);
    lines.push(`DTSTART;VALUE=DATE:${ymd(start)}`, `DTEND;VALUE=DATE:${ymd(end)}`);
    alarms = ['-PT15H', 'PT9H'];  // 전날 9시, 당일 9시
  }
  lines.push(`SUMMARY:${esc(title)}`);
  if (note) lines.push(`DESCRIPTION:${esc(note)}`);
  if (location) lines.push(`LOCATION:${esc(location)}`);
  for (const trigger of alarms) {
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, `TRIGGER:${trigger}`, 'END:VALARM');
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** 일정 파일을 내려받게 함 → 휴대폰에서 열면 달력 앱으로 들어감 */
export function saveIcs(ics, fileName) {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName.replace(/[\\/:*?"<>|]/g, '').slice(0, 40) || 'ttobak'}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
