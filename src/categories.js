export const GROUPS = {
  spell: { label: 'Spelling' },
  sandhi: { label: 'Joining (சந்தி)' },
  gram: { label: 'Grammar' },
  style: { label: 'Style' },
};

export const CATS = {
  pulli: { g: 'spell', label: 'Missing புள்ளி' },
  vowel: { g: 'spell', label: 'Vowel or vowel sign' },
  l_sound: { g: 'spell', label: 'ல / ள / ழ' },
  n_sound: { g: 'spell', label: 'ன / ண / ந' },
  r_sound: { g: 'spell', label: 'ர / ற' },
  double: { g: 'spell', label: 'Double consonant' },
  spelling: { g: 'spell', label: 'Spelling' },
  sandhi: { g: 'sandhi', label: 'வல்லினம் / சந்தி' },
  word_order: { g: 'gram', label: 'Word order' },
  agreement: { g: 'gram', label: 'Verb ending' },
  pronoun: { g: 'gram', label: 'Pronoun form' },
  case_ending: { g: 'gram', label: 'Case ending' },
  english_pattern: { g: 'gram', label: 'English sentence pattern' },
  tense: { g: 'gram', label: 'Tense' },
  spoken: { g: 'style', label: 'Spoken Tamil' },
  english_word: { g: 'style', label: 'English word' },
  formality: { g: 'style', label: 'நீ / நீங்கள் mix' },
  punctuation: { g: 'style', label: 'Punctuation' },
  text_type: { g: 'style', label: 'Text type' },
  word_choice: { g: 'style', label: 'Word choice' },
  spacing: { g: 'spell', label: 'Word spacing' },
  sentence: { g: 'gram', label: 'Sentence structure' },
};

export const catOf = (i) => CATS[i?.category] || { g: 'gram', label: 'Grammar' };

export const TEXT_TYPES = [
  ['general writing', 'General writing'],
  ['informal letter or email to a friend', 'Informal letter / email'],
  ['formal letter', 'Formal letter'],
  ['article', 'Article'],
  ['blog post', 'Blog post'],
  ['script of a speech', 'Speech'],
  ['diary or journal entry', 'Diary / journal entry'],
  ['report', 'Report'],
  ['story', 'Story'],
  ['review', 'Review'],
];
export const typeLabel = (v) => (TEXT_TYPES.find(([k]) => k === v) || [v, v])[1];

// Count mistakes by group and by category across submissions.
export function tally(subs) {
  const groups = { spell: 0, sandhi: 0, gram: 0, style: 0 };
  const cats = {};
  for (const s of subs) for (const i of s.issues || []) {
    groups[catOf(i).g]++;
    const k = CATS[i.category] ? i.category : 'spelling';
    cats[k] = (cats[k] || 0) + 1;
  }
  const top = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  return { groups, cats, top, total: Object.values(groups).reduce((a, b) => a + b, 0) };
}

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
