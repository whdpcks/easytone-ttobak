/** Pure data-to-UI mapping, with no dependency on A's router or design system. */

function nonEmpty(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(nonEmpty);
  if (typeof value === 'object') return Object.entries(value).some(([key, part]) => key !== 'check' && nonEmpty(part));
  return false;
}

function preview(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(item => typeof item === 'string' ? item : item?.name).filter(Boolean).slice(0, 2).join(' · ');
  return '';
}

export function buildResultTiles(document) {
  if (!document || document.status !== 'completed') return [];

  const dateInfo = document.datetime;
  const readableDate = dateInfo?.date || dateInfo?.label || dateInfo?.time || '';

  const tiles = [
    { key: 'summary', label: '한눈에 보기', icon: '📄', value: document.summary, teaser: preview(document.summary) },
    {
      key: 'datetime', label: '날짜와 시간', icon: '📅', value: dateInfo,
      teaser: [readableDate, dateInfo?.date ? dateInfo?.time : null].filter(Boolean).join(' · '),
      needsReview: dateInfo?.check === true,
    },
    { key: 'place', label: '어디로 가나요?', icon: '📍', value: document.place, teaser: document.place?.name || document.place?.address || '' },
    { key: 'items', label: '준비할 것', icon: '🎒', value: document.items, teaser: preview(document.items) },
    { key: 'cautions', label: '조심할 점', icon: '💡', value: document.cautions, teaser: preview(document.cautions) },
    { key: 'contact', label: '전화할 곳', icon: '☎️', value: document.contact, teaser: document.contact?.name || document.contact?.phone || '' },
    { key: 'category', label: '문서 종류', icon: '🗂️', value: document.category, teaser: document.category || '' },
  ];

  return tiles.filter(tile => nonEmpty(tile.value));
}

