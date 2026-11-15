import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SETS } from '../supabase/practice/workbook.mjs';
import { seedSql, SEED_FILE } from '../scripts/practice-seed.mjs';
import { checkSet, scoreItems, itemMax, shuffled, stars } from '../src/lib/practice.js';
import { youtubeId, fileExt, fmtSize, FILE_TYPES } from '../src/lib/media.js';

test('every workbook game is well formed', () => {
  assert.deepEqual(SETS.flatMap(checkSet), []);
  assert.equal(new Set(SETS.map((s) => s.slug)).size, SETS.length);
  assert.deepEqual([...new Set(SETS.map((s) => s.stage))], [1, 2, 3, 4, 5, 6]);
  for (const s of SETS) assert.ok(s.title_ta && s.topic_ta && s.intro && s.intro_ta && s.source, s.slug);
});
test('right answers are spread across the positions', () => {
  const pos = SETS.flatMap((s) => s.items).filter((i) => i.t === 'choice' && i.options.length === 4).map((i) => i.answer);
  for (const p of [0, 1, 2, 3]) assert.ok(pos.filter((x) => x === p).length >= pos.length / 8, `position ${p}`);
});
test('the seed migration matches the game source', () => {
  assert.equal(readFileSync(SEED_FILE, 'utf8'), seedSql());
});
test('bad games are reported', () => {
  const base = { slug: 'x-game', topic: 'T', title: 'T' };
  assert.ok(checkSet({ ...base, items: [{ t: 'choice', q: 'q', why: 'w', options: ['a', 'b'], answer: 2 }] }).length);
  assert.ok(checkSet({ ...base, items: [{ t: 'choice', q: 'q', why: 'w', options: ['a', 'a'], answer: 0 }] }).length);
  assert.ok(checkSet({ ...base, items: [{ t: 'match', q: 'q', why: 'w', pairs: [['a', 'b'], ['a', 'c']] }] }).length);
  assert.ok(checkSet({ ...base, items: [{ t: 'order', q: 'q', why: 'w', lines: ['a'] }] }).length);
  assert.ok(checkSet({ ...base, items: [] }).length);
});
test('marking: one mark per question, pair or line', () => {
  const items = [
    { t: 'choice', options: ['a', 'b', 'c'], answer: 1 },
    { t: 'spot', words: ['a', 'b'], answer: 0 },
    { t: 'match', pairs: [['a', '1'], ['b', '2'], ['c', '3']] },
    { t: 'order', lines: ['x', 'y', 'z', 'w'] },
  ];
  assert.deepEqual(items.map(itemMax), [1, 1, 3, 4]);
  assert.deepEqual(scoreItems(items, [1, 0, [0, 1, 2], [0, 1, 2, 3]]), { score: 9, total: 9 });
  assert.deepEqual(scoreItems(items, [0, 1, [1, 0, 2], [3, 1, 2, 0]]), { score: 3, total: 9 });
  assert.deepEqual(scoreItems(items, [null, '0', 'x', null]), { score: 0, total: 9 });
  assert.deepEqual(scoreItems(items, []), { score: 0, total: 9 });
  assert.deepEqual([stars(9, 10), stars(7, 10), stars(4, 10), stars(3, 10)], [3, 2, 1, 0]);
});
test('shuffling keeps every position and changes the order', () => {
  for (let n = 2; n < 9; n++) {
    const a = shuffled(n);
    assert.deepEqual([...a].sort(), Array.from({ length: n }, (_, i) => i));
    assert.ok(a.some((v, i) => v !== i));
  }
  assert.deepEqual(shuffled(3, () => 0.999), [1, 2, 0]);
});
test('YouTube links', () => {
  const id = 'dQw4w9WgXcQ';
  for (const u of [`https://www.youtube.com/watch?v=${id}`, `https://youtu.be/${id}?si=abc`, `https://m.youtube.com/watch?v=${id}&t=30s`,
    `https://www.youtube.com/shorts/${id}`, `https://www.youtube.com/embed/${id}`, `https://www.youtube.com/live/${id}?feature=share`, `  https://youtu.be/${id} `]) {
    assert.equal(youtubeId(u), id, u);
  }
  for (const u of ['', null, 'youtube', 'https://example.org/watch?v=' + id, 'https://youtube.com.evil.org/watch?v=' + id,
    'https://www.youtube.com/watch?v=short', 'javascript:alert(1)', 'https://www.youtube.com/channel/abc']) {
    assert.equal(youtubeId(u), null, String(u));
  }
});
test('file helpers', () => {
  assert.equal(fileExt('Week 4 Homework.PDF'), 'pdf');
  assert.equal(fileExt('noext'), '');
  assert.ok(FILE_TYPES[fileExt('notes.docx')]);
  assert.equal(fmtSize(2 * 1048576), '2.0 MB');
  assert.equal(fmtSize(500), '1 KB');
});
