import React, { useState } from 'react';
import { supabase, errText } from '../supabase.js';
import { t } from '../i18n.js';
import { checkSet } from '../lib/practice.js';
import Game from './Game.jsx';

const TYPES = {
  choice: { en: 'Choose the answer', ta: 'விடையைத் தேர்ந்தெடு' },
  spot: { en: 'Tap the wrong word', ta: 'பிழையான சொல்லைத் தொடு' },
  match: { en: 'Match the pairs', ta: 'இணைகளைப் பொருத்து' },
  order: { en: 'Put in order', ta: 'வரிசைப்படுத்து' },
};
let keys = 0;
const keyed = (it) => ({ ...it, _k: ++keys });
const fresh = (type) => keyed({
  choice: { t: 'choice', q: '', sub: '', options: ['', '', '', ''], answer: 0, why: '' },
  spot: { t: 'spot', q: 'பிழையான சொல்லைத் தொடவும்.', words: [], answer: 0, fix: '', why: '' },
  match: { t: 'match', q: 'பொருத்தவும்.', pairs: [['', ''], ['', ''], ['', '']], why: '' },
  order: { t: 'order', q: 'சரியான வரிசையில் அமைக்கவும்.', lines: ['', '', ''], why: '' },
}[type]);
export const blankGame = (stage = 1) => ({ stage, topic: '', topic_ta: '', title: '', title_ta: '', intro: '', intro_ta: '', source: '', items: [fresh('choice')] });

// Words on one line become the buttons; several lines make each line a button.
const piecesOf = (text) => (text.includes('\n') ? text.split('\n') : text.split(/\s+/)).map((x) => x.trim()).filter(Boolean);
const textOf = (words) => (words.some((w) => /\s/.test(w)) ? words.join('\n') : words.join(' '));

// What is saved: trimmed text, no empty optional fields.
function clean(it) {
  const base = { t: it.t, q: (it.q || '').trim() };
  const why = (it.why || '').trim();
  if (it.t === 'choice') {
    const sub = (it.sub || '').trim();
    Object.assign(base, sub ? { sub } : {}, { options: it.options.map((x) => x.trim()), answer: it.answer });
  } else if (it.t === 'spot') {
    const fix = (it.fix || '').trim();
    Object.assign(base, { words: it.words, answer: it.answer }, fix ? { fix } : {});
  } else if (it.t === 'match') base.pairs = it.pairs.map((p) => [p[0].trim(), p[1].trim()]);
  else base.lines = it.lines.map((x) => x.trim());
  if (why) base.why = why;
  return base;
}
const moved = (list, i, d) => { const a = [...list]; [a[i], a[i + d]] = [a[i + d], a[i]]; return a; };

function Rows({ list, onChange, min, max, render, addLabel }) {
  return (
    <div className="ed-rows">
      {list.map((v, i) => (
        <div key={i} className="ed-row">
          {render(v, i)}
          <button type="button" className="btn small" disabled={list.length <= min} onClick={() => onChange(list.filter((_, j) => j !== i))} aria-label={t('Remove')}>✕</button>
        </div>
      ))}
      {list.length < max && <button type="button" className="btn small ed-add" onClick={() => onChange(null)}>+ {addLabel}</button>}
    </div>
  );
}

function Question({ it, n, total, onChange, onMove, onRemove, onCopy }) {
  const set = (patch) => onChange({ ...it, ...patch });
  const [spotText, setSpotText] = useState(() => (it.t === 'spot' ? textOf(it.words) : ''));
  return (
    <li className="ed-q">
      <div className="row between wrap">
        <b>{t('Question {n}', { n })} · <span className="muted">{t(TYPES[it.t].en)}</span></b>
        <span className="row">
          <button type="button" className="btn small" disabled={n === 1} onClick={() => onMove(-1)} aria-label={t('Move up')}>↑</button>
          <button type="button" className="btn small" disabled={n === total} onClick={() => onMove(1)} aria-label={t('Move down')}>↓</button>
          <button type="button" className="btn small" onClick={onCopy}>{t('Copy')}</button>
          <button type="button" className="btn small" disabled={total === 1} onClick={onRemove}>{t('Delete')}</button>
        </span>
      </div>
      <label className="field">{t('Question or instruction')}<textarea rows={2} lang="ta" value={it.q} onChange={(e) => set({ q: e.target.value })} maxLength={600} /></label>

      {it.t === 'choice' && (
        <>
          <label className="field">{t('Sentence or passage the question is about (optional)')}<textarea rows={2} lang="ta" value={it.sub || ''} onChange={(e) => set({ sub: e.target.value })} maxLength={600} /></label>
          <div className="field">{t('Answers: tick the right one')}
            <Rows list={it.options} min={2} max={6} addLabel={t('Add an answer')}
              onChange={(next) => (next ? set({ options: next, answer: Math.min(it.answer, next.length - 1) }) : set({ options: [...it.options, ''] }))}
              render={(v, i) => (
                <>
                  <input type="radio" name={`ans-${n}`} checked={it.answer === i} onChange={() => set({ answer: i })} aria-label={t('Right answer')} />
                  <input className="grow" lang="ta" value={v} maxLength={600} onChange={(e) => set({ options: it.options.map((x, j) => (j === i ? e.target.value : x)) })} />
                </>
              )} />
          </div>
        </>
      )}

      {it.t === 'spot' && (
        <>
          <label className="field">{t('Sentence with the mistake')}
            <textarea rows={2} lang="ta" value={spotText} onChange={(e) => { setSpotText(e.target.value); const w = piecesOf(e.target.value); set({ words: w, answer: Math.min(it.answer, Math.max(0, w.length - 1)) }); }} />
          </label>
          <span className="small muted">{t('Each word becomes a button. To make whole sentences the buttons, put each sentence on its own line.')}</span>
          {it.words.length > 0 && (
            <div className="field">{t('Tap the word the student must find')}
              <div className="g-words">{it.words.map((w, i) => (
                <button key={i} type="button" lang="ta" className={'g-word' + (i === it.answer ? ' wrong' : '')} onClick={() => set({ answer: i })}>{w}</button>
              ))}</div>
            </div>
          )}
          <label className="field">{t('Correct form (optional)')}<input lang="ta" value={it.fix || ''} onChange={(e) => set({ fix: e.target.value })} maxLength={300} /></label>
        </>
      )}

      {it.t === 'match' && (
        <div className="field">{t('Pairs: each left item with its partner')}
          <Rows list={it.pairs} min={2} max={8} addLabel={t('Add a pair')}
            onChange={(next) => set({ pairs: next || [...it.pairs, ['', '']] })}
            render={(p, i) => [0, 1].map((k) => (
              <input key={k} className="grow" lang="ta" value={p[k]} maxLength={600} placeholder={k ? t('Partner') : t('Item')}
                onChange={(e) => set({ pairs: it.pairs.map((x, j) => (j === i ? (k ? [x[0], e.target.value] : [e.target.value, x[1]]) : x)) })} />
            ))} />
        </div>
      )}

      {it.t === 'order' && (
        <div className="field">{t('Lines, in the correct order (students see them mixed up)')}
          <Rows list={it.lines} min={2} max={8} addLabel={t('Add a line')}
            onChange={(next) => set({ lines: next || [...it.lines, ''] })}
            render={(v, i) => (
              <>
                <span className="g-badge">{i + 1}</span>
                <input className="grow" lang="ta" value={v} maxLength={600} onChange={(e) => set({ lines: it.lines.map((x, j) => (j === i ? e.target.value : x)) })} />
                <button type="button" className="btn small" disabled={i === 0} onClick={() => set({ lines: moved(it.lines, i, -1) })} aria-label={t('Move up')}>↑</button>
              </>
            )} />
        </div>
      )}

      <label className="field">{t('Explanation shown after the answer (optional)')}<textarea rows={2} value={it.why || ''} onChange={(e) => set({ why: e.target.value })} maxLength={600} /></label>
    </li>
  );
}

// Admin: change a game's details and questions, or build a new game.
export default function GameEditor({ game, nextSort, onSaved, onClose }) {
  const isNew = !game.id;
  const [g, setG] = useState(() => ({ ...game, items: game.items.map(keyed) }));
  const [msg, setMsg] = useState('');
  const [problems, setProblems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [trying, setTrying] = useState(false);
  const [dirty, setDirty] = useState(false);
  // Any change clears the old list of points to fix.
  const touch = () => { setDirty(true); setProblems([]); setMsg(''); };
  const set = (k) => (e) => { touch(); setG((x) => ({ ...x, [k]: e.target.value })); };
  const setItems = (items) => { touch(); setG((x) => ({ ...x, items })); };

  function built() {
    const set0 = {
      slug: g.slug || `custom-${crypto.randomUUID().slice(0, 8)}`, stage: Number(g.stage) || 1,
      topic: g.topic.trim() || g.title.trim(), topic_ta: (g.topic_ta || '').trim(), title: g.title.trim(), title_ta: (g.title_ta || '').trim(),
      intro: (g.intro || '').trim(), intro_ta: (g.intro_ta || '').trim(), source: (g.source || '').trim(), items: g.items.map(clean),
    };
    // checkSet starts each line with the game's short name; show the rest.
    const found = checkSet(set0).map((p) => { const x = p.slice(set0.slug.length).replace(/^:?\s*/, ''); return /topic and title/.test(x) ? t('Give the game a name.') : x[0].toUpperCase() + x.slice(1); });
    return { set0, found };
  }
  function check() {
    const { set0, found } = built();
    setProblems(found);
    if (found.length) { setMsg(t('Please fix the points below first.')); return null; }
    setMsg(''); return set0;
  }
  async function save() {
    const row = check(); if (!row) return;
    setBusy(true);
    const { error } = isNew
      ? await supabase.from('practice_sets').insert({ ...row, sort: nextSort })
      : await supabase.from('practice_sets').update((({ slug, ...rest }) => rest)(row)).eq('id', g.id);
    setBusy(false);
    if (error) { setMsg(errText(error)); return; }
    onSaved(isNew ? t('Game saved. It is hidden until you give it to teachers.') : t('Game saved. Classes that already have it see the new version.'));
  }
  async function remove() {
    if (!confirm(t('Delete “{title}” for good? It is removed from every class, and all scores for it are deleted.', { title: g.title }))) return;
    const { error } = await supabase.from('practice_sets').delete().eq('id', g.id);
    if (error) { setMsg(errText(error)); return; }
    onSaved(t('Game deleted.'));
  }
  function close() {
    if (dirty && !confirm(t('Close without saving your changes?'))) return;
    onClose();
  }

  if (trying) {
    const { set0 } = built();
    return <Game set={{ ...set0, id: 'draft' }} preview onClose={() => setTrying(false)} />;
  }
  return (
    <div className="stack editor">
      <div className="row between wrap">
        <h2 className="title">{isNew ? t('New game') : t('Edit game')}</h2>
        <button type="button" className="btn small" onClick={close}>{t('Close')}</button>
      </div>
      <section className="card form">
        <div className="ed-two">
          <label className="field">{t('Game name (English)')}<input value={g.title} onChange={set('title')} maxLength={120} /></label>
          <label className="field">{t('Game name (Tamil)')}<input lang="ta" value={g.title_ta || ''} onChange={set('title_ta')} maxLength={120} /></label>
          <label className="field">{t('Topic (English)')}<input value={g.topic} onChange={set('topic')} maxLength={120} placeholder={t('e.g. Sentence accuracy')} /></label>
          <label className="field">{t('Topic (Tamil)')}<input lang="ta" value={g.topic_ta || ''} onChange={set('topic_ta')} maxLength={120} /></label>
          <label className="field">{t('Stage')}
            <select value={g.stage} onChange={set('stage')}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{t('Stage {n}', { n: i + 1 })}</option>)}</select>
          </label>
          <label className="field">{t('Source (optional)')}<input value={g.source || ''} onChange={set('source')} maxLength={120} placeholder={t('e.g. Workbook Q02–Q07')} /></label>
        </div>
        <label className="field">{t('Instructions for students (English)')}<textarea rows={2} value={g.intro || ''} onChange={set('intro')} maxLength={600} /></label>
        <label className="field">{t('Instructions for students (Tamil)')}<textarea rows={2} lang="ta" value={g.intro_ta || ''} onChange={set('intro_ta')} maxLength={600} /></label>
      </section>

      <ol className="ed-list">
        {g.items.map((it, i) => (
          <Question key={it._k} it={it} n={i + 1} total={g.items.length}
            onChange={(next) => setItems(g.items.map((x, j) => (j === i ? next : x)))}
            onMove={(d) => setItems(moved(g.items, i, d))}
            onRemove={() => setItems(g.items.filter((_, j) => j !== i))}
            onCopy={() => setItems([...g.items.slice(0, i + 1), keyed(JSON.parse(JSON.stringify(it))), ...g.items.slice(i + 1)])} />
        ))}
      </ol>

      <section className="card">
        <h3>{t('Add a question')}</h3>
        <div className="row wrap">
          {Object.entries(TYPES).map(([k, v]) => (
            <button key={k} type="button" className="btn small" disabled={g.items.length >= 40} onClick={() => setItems([...g.items, fresh(k)])}>+ {t(v.en)}</button>
          ))}
        </div>
      </section>

      <section className="card ed-save">
        {msg && <p className="small bad" role="alert">{msg}</p>}
        {problems.length > 0 && <ul className="small bad">{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>}
        <div className="row wrap">
          <button type="button" className="btn primary" disabled={busy} onClick={save}>{busy ? t('Please wait…') : t('Save game')}</button>
          <button type="button" className="btn" onClick={() => { if (check()) setTrying(true); }}>{t('Try it')}</button>
          <button type="button" className="btn" onClick={close}>{t('Cancel')}</button>
          {!isNew && <button type="button" className="btn ed-del" onClick={remove}>{t('Delete game')}</button>}
        </div>
        <p className="small muted">{t('Scores students already have are kept as they are. A new game stays hidden until you give it to teachers.')}</p>
      </section>
    </div>
  );
}
