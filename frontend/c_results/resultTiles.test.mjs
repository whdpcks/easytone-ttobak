import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResultTiles, getVoiceDescription } from './resultTiles.mjs';

const completeDocument = {
  id: 12,
  status: 'completed',
  title: '건강검진 안내문',
  category: '병원·건강',
  summary: ['건강검진을 받으세요.'],
  datetime: { date: '2026-11-20', time: '09:00', label: '검진 날', note: null, check: true },
  place: null,
  items: [{ name: '신분증', detail: null }],
  cautions: null,
  contact: { name: '고객센터', phone: '123' },
};

test('shows only existing detail tiles while keeping category', () => {
  const keys = buildResultTiles(completeDocument).map(tile => tile.key);
  assert.deepEqual(keys, ['summary', 'datetime', 'items', 'contact', 'category']);
});

test('shows manual date verification warning', () => {
  const dateTile = buildResultTiles(completeDocument).find(tile => tile.key === 'datetime');
  assert.equal(dateTile.needsReview, true);
  assert.match(dateTile.teaser, /2026-11-20/);
});

test('does not display tiles for incomplete analyses', () => {
  assert.deepEqual(buildResultTiles({ ...completeDocument, status: 'processing' }), []);
});

test('generates concise voice intro for A to read', () => {
  assert.equal(getVoiceDescription(completeDocument), '건강검진 안내문이에요. 보고 싶은 내용을 눌러주세요.');
});
