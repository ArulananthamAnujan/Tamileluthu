// Practice games: marking and checks shared by the website, the seed script and the tests.
// The database marks a finished game the same way (private.practice_finish).

export const GAME_TYPES = ['choice', 'spot', 'match', 'order'];

// How many marks a question is worth: one, or one per pair/line.
export function itemMax(it) {
  if (it.t === 'match') return it.pairs.length;
  if (it.t === 'order') return it.lines.length;
  return 1;
}

// Marks for one answer. choice/spot: the chosen position. match/order: the
// student's arrangement as a list of original positions (correct = 0, 1, 2…).
export function itemScore(it, a) {
  if (it.t === 'match' || it.t === 'order') {
    if (!Array.isArray(a)) return 0;
    let s = 0;
    for (let k = 0; k < itemMax(it); k++) if (a[k] === k) s++;
    return s;
  }
  return typeof a === 'number' && a === it.answer ? 1 : 0;
}

export function scoreItems(items, answers) {
  let score = 0; let total = 0;
  items.forEach((it, i) => { total += itemMax(it); score += itemScore(it, answers?.[i]); });
  return { score, total };
}

export const percent = (score, total) => (total ? Math.round((score / total) * 100) : 0);
// 3 stars from 90%, 2 from 70%, 1 from 40%.
export const stars = (score, total) => { const p = percent(score, total); return p >= 90 ? 3 : p >= 70 ? 2 : p >= 40 ? 1 : 0; };

// A shuffled list of positions 0…n-1 that is never left in the original order.
export function shuffled(n, rand = Math.random) {
  const a = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return a;
  for (let tries = 0; tries < 20; tries++) {
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    if (a.some((v, i) => v !== i)) return a;
  }
  return [...a.slice(1), a[0]];
}

const text = (v, max = 600) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const distinct = (list) => new Set(list).size === list.length;

// Problems with a game, as a list of sentences (empty when it is fine).
export function checkSet(set) {
  const out = [];
  const bad = (i, why) => out.push(`${set.slug || '?'} question ${i + 1}: ${why}`);
  if (!/^[a-z0-9-]{3,60}$/.test(set.slug || '')) out.push(`${set.slug}: bad slug`);
  if (!text(set.topic, 120) || !text(set.title, 120)) out.push(`${set.slug}: topic and title are needed`);
  if (!Array.isArray(set.items) || set.items.length < 1 || set.items.length > 40) { out.push(`${set.slug}: 1 to 40 questions are needed`); return out; }
  set.items.forEach((it, i) => {
    if (!GAME_TYPES.includes(it.t)) return bad(i, `unknown type ${it.t}`);
    if (!text(it.q)) bad(i, 'the question text is missing');
    if (!text(it.why)) bad(i, 'the explanation is missing');
    if (it.t === 'choice') {
      if (!Array.isArray(it.options) || it.options.length < 2 || it.options.length > 6 || !it.options.every((x) => text(x))) bad(i, '2 to 6 options are needed');
      else if (!distinct(it.options)) bad(i, 'two options are the same');
      else if (!Number.isInteger(it.answer) || it.answer < 0 || it.answer >= it.options.length) bad(i, 'the answer is not one of the options');
    } else if (it.t === 'spot') {
      if (!Array.isArray(it.words) || it.words.length < 2 || it.words.length > 12 || !it.words.every((x) => text(x))) bad(i, '2 to 12 words are needed');
      else if (!Number.isInteger(it.answer) || it.answer < 0 || it.answer >= it.words.length) bad(i, 'the answer is not one of the words');
    } else if (it.t === 'match') {
      if (!Array.isArray(it.pairs) || it.pairs.length < 2 || it.pairs.length > 8
          || !it.pairs.every((p) => Array.isArray(p) && p.length === 2 && text(p[0]) && text(p[1]))) bad(i, '2 to 8 pairs are needed');
      else if (!distinct(it.pairs.map((p) => p[0])) || !distinct(it.pairs.map((p) => p[1]))) bad(i, 'two pairs share the same text');
    } else if (!Array.isArray(it.lines) || it.lines.length < 2 || it.lines.length > 8 || !it.lines.every((x) => text(x))) bad(i, '2 to 8 lines are needed');
    else if (!distinct(it.lines)) bad(i, 'two lines are the same');
  });
  return out;
}
