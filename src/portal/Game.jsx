import React, { useEffect, useMemo, useRef, useState } from 'react';
import { t, getLang } from '../i18n.js';
import { buzz } from '../app/isApp.js';
import { itemMax, itemScore, scoreItems, percent, stars, shuffled } from '../lib/practice.js';

// Text of a game in the reader's language (falls back to English).
export const pick = (o, k) => (getLang() === 'ta' && o?.[k + '_ta'] ? o[k + '_ta'] : o?.[k] || '');
export const marksOf = (set) => set.items.reduce((n, it) => n + itemMax(it), 0);
export function Stars({ n, big }) {
  return (
    <span className={'g-stars' + (big ? ' big' : '')} role="img" aria-label={t('{n} of 3 stars', { n })}>
      {[1, 2, 3].map((i) => <span key={i} className={i <= n ? 'on' : ''} aria-hidden="true">★</span>)}
    </span>
  );
}
const HUES = ['var(--accent)', 'var(--gold)', 'var(--gram)', 'var(--style)', 'var(--spell)', 'var(--ok)', 'var(--sandhi)', 'var(--muted)'];
const mix = (n) => { const a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// One finished question: what the student should take away.
function Feedback({ item, got }) {
  const full = got === itemMax(item);
  return (
    <div className={'g-fb ' + (full ? 'g-good' : 'g-miss')} role="status">
      <b>{full ? t('Correct!') : got > 0 ? t('{n} of {max} correct', { n: got, max: itemMax(item) }) : t('Not quite.')}</b>
      {item.t === 'spot' && item.fix && <p lang="ta" className="g-fix"><s>{item.words[item.answer]}</s> → <b>{item.fix}</b></p>}
      <p>{pick(item, 'why')}</p>
    </div>
  );
}

function Choice({ item, done, onAnswer }) {
  const perm = useMemo(() => mix(item.options.length), [item]);
  const [picked, setPicked] = useState(null);
  return (
    <div className="g-opts">
      {perm.map((orig, d) => {
        const cls = !done ? '' : orig === item.answer ? ' right' : d === picked ? ' wrong' : ' dim';
        return (
          <button key={orig} type="button" lang="ta" className={'g-opt' + cls} disabled={done}
            onClick={() => { setPicked(d); onAnswer(orig); }}>
            <span className="g-key" aria-hidden="true">{'அஆஇஈஉஊ'[d]}</span><span>{item.options[orig]}</span>
          </button>
        );
      })}
    </div>
  );
}

function Spot({ item, done, onAnswer }) {
  const [picked, setPicked] = useState(null);
  const long = item.words.some((w) => w.length > 28);
  return (
    <div className={'g-words' + (long ? ' lines' : '')}>
      {item.words.map((w, i) => {
        const cls = !done ? '' : i === item.answer ? ' right' : i === picked ? ' wrong' : ' dim';
        return <button key={i} type="button" lang="ta" className={'g-word' + cls} disabled={done} onClick={() => { setPicked(i); onAnswer(i); }}>{w}</button>;
      })}
    </div>
  );
}

function Match({ item, done, onAnswer }) {
  const n = item.pairs.length;
  const perm = useMemo(() => shuffled(n), [item]); // perm[display position] = original right-hand item
  const [link, setLink] = useState(() => Array(n).fill(null)); // link[left] = display position on the right
  const [sel, setSel] = useState(0);
  const owner = (d) => link.indexOf(d);
  function tapRight(d) {
    if (done) return;
    buzz();
    const cur = owner(d);
    if (sel == null) { if (cur >= 0) { setLink(link.map((v, i) => (i === cur ? null : v))); setSel(cur); } return; }
    const next = link.map((v) => (v === d ? null : v));
    next[sel] = d;
    setLink(next);
    const free = next.findIndex((v) => v == null);
    setSel(free >= 0 ? free : null);
  }
  const all = link.every((v) => v != null);
  return (
    <div className="g-match">
      <p className="small muted">{t('Tap an item on top, then tap its partner below.')}</p>
      <div className="g-left">
        {item.pairs.map((p, i) => (
          <button key={i} type="button" lang="ta" style={{ '--c': HUES[i % HUES.length] }} disabled={done}
            className={'g-pill' + (sel === i ? ' sel' : '') + (link[i] != null ? ' used' : '') + (done ? (perm[link[i]] === i ? ' right' : ' wrong') : '')}
            onClick={() => { buzz(); setSel(sel === i ? null : i); }}>
            <span className="g-badge">{i + 1}</span>{p[0]}
          </button>
        ))}
      </div>
      <div className="g-right">
        {perm.map((orig, d) => {
          const o = owner(d);
          const cls = !done ? (o >= 0 ? ' used' : '') : o === orig ? ' right' : ' wrong';
          return (
            <button key={orig} type="button" lang="ta" className={'g-card' + cls} disabled={done} onClick={() => tapRight(d)}
              style={o >= 0 ? { '--c': HUES[o % HUES.length] } : undefined}>
              <span className={'g-badge' + (o >= 0 ? '' : ' empty')}>{o >= 0 ? o + 1 : ''}</span>
              <span>{item.pairs[orig][1]}{done && o !== orig && <em className="g-should"> {t('Goes with')} {orig + 1}: {item.pairs[orig][0]}</em>}</span>
            </button>
          );
        })}
      </div>
      {!done && <button type="button" className="btn primary big" disabled={!all} onClick={() => onAnswer(link.map((d) => perm[d]))}>{t('Check')}</button>}
    </div>
  );
}

function Order({ item, done, onAnswer }) {
  const n = item.lines.length;
  const perm = useMemo(() => shuffled(n), [item]);
  const [seq, setSeq] = useState([]); // display positions, in the order the student tapped them
  function tap(d) {
    if (done) return;
    buzz();
    setSeq(seq.includes(d) ? seq.filter((x) => x !== d) : [...seq, d]);
  }
  return (
    <div className="g-match">
      <p className="small muted">{t('Tap the lines in the right order. Tap a line again to take it out.')}</p>
      <div className="g-right">
        {perm.map((orig, d) => {
          const pos = seq.indexOf(d);
          const cls = !done ? (pos >= 0 ? ' used' : '') : pos === orig ? ' right' : ' wrong';
          return (
            <button key={orig} type="button" lang="ta" className={'g-card' + cls} disabled={done} onClick={() => tap(d)}>
              <span className={'g-badge' + (pos >= 0 ? '' : ' empty')}>{pos >= 0 ? pos + 1 : ''}</span>
              <span>{item.lines[orig]}{done && pos !== orig && <em className="g-should"> {t('Should be number {n}', { n: orig + 1 })}</em>}</span>
            </button>
          );
        })}
      </div>
      {!done && <button type="button" className="btn primary big" disabled={seq.length < n} onClick={() => onAnswer(seq.map((d) => perm[d]))}>{t('Check')}</button>}
    </div>
  );
}

const BODY = { choice: Choice, spot: Spot, match: Match, order: Order };

// The right answer to one question, for the review at the end.
function Key({ item }) {
  if (item.t === 'choice') return <p lang="ta">{item.options[item.answer]}</p>;
  if (item.t === 'spot') return <p lang="ta">{item.fix ? <><s>{item.words[item.answer]}</s> → <b>{item.fix}</b></> : <s>{item.words[item.answer]}</s>}</p>;
  if (item.t === 'match') return <ul lang="ta">{item.pairs.map((p, i) => <li key={i}><b>{p[0]}</b> → {p[1]}</li>)}</ul>;
  return <ol lang="ta">{item.lines.map((l, i) => <li key={i}>{l}</li>)}</ol>;
}

// Plays one practice game from start to score.
//   onFinish(answers) saves the result and returns { score, total } (not called in preview).
export default function Game({ set, preview, best, onFinish, onClose }) {
  const items = set.items;
  const [phase, setPhase] = useState('intro');
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [run, setRun] = useState(0);
  const [save, setSave] = useState({ state: 'idle' });
  const top = useRef(null);
  const item = items[idx];
  const answered = answers.length > idx;
  const sofar = scoreItems(items.slice(0, answers.length), answers);

  useEffect(() => { top.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }); }, [idx, phase]);

  function answer(a) {
    if (answered) return;
    buzz(itemScore(item, a) === itemMax(item) ? 10 : [20, 40, 20]);
    setAnswers([...answers, a]);
  }
  async function finish(all) {
    setPhase('done');
    if (preview || !onFinish) return;
    setSave({ state: 'saving' });
    try { await onFinish(all); setSave({ state: 'saved' }); } catch (e) { setSave({ state: 'error', text: e.message }); }
  }
  function next() {
    if (idx + 1 < items.length) setIdx(idx + 1); else finish(answers);
  }
  function again() { setAnswers([]); setIdx(0); setRun(run + 1); setSave({ state: 'idle' }); setPhase('play'); }

  const head = (
    <div className="g-head" ref={top}>
      <div>
        <span className="tag">{t('Stage {n}', { n: set.stage })}</span>
        {preview && <span className="tag k-announcement">{t('Preview')}</span>}
        <h2 className="title">{pick(set, 'title')}</h2>
        <p className="small muted">{pick(set, 'topic')}{set.source ? ` · ${set.source}` : ''}</p>
      </div>
      <button type="button" className="btn small" onClick={onClose}>{t('Close')}</button>
    </div>
  );

  if (phase === 'intro') {
    return (
      <section className="card game">
        {head}
        <p className="g-intro">{pick(set, 'intro')}</p>
        <div className="row wrap small muted">
          <span>{t('{n} questions', { n: items.length })}</span><span>·</span><span>{t('{n} marks', { n: marksOf(set) })}</span>
          {best && <><span>·</span><span>{t('Your best')}: <b>{best.score}/{best.total}</b> <Stars n={stars(best.score, best.total)} /></span></>}
        </div>
        {preview && <p className="small muted">{t('This is a preview. Nothing is saved, and students cannot see this game until a teacher releases it.')}</p>}
        <div className="row"><button type="button" className="btn primary big" onClick={() => setPhase('play')}>{t('Start')}</button></div>
      </section>
    );
  }

  if (phase === 'done') {
    const { score, total } = scoreItems(items, answers);
    const s = stars(score, total);
    const beat = best && score > best.score;
    return (
      <section className="card game">
        {head}
        <div className="g-result">
          <div className="g-ring" style={{ '--p': percent(score, total) }}><span><b>{score}</b><small>/ {total}</small></span></div>
          <div>
            <Stars n={s} big />
            <p className="g-msg">{[t('Keep practising. Read the explanations below and try again.'), t('A good start. Try again to beat your score.'), t('Well done!'), t('Excellent! நன்று!')][s]}</p>
            <p className="small muted">{percent(score, total)}%{beat ? ` · ${t('New best score!')}` : best ? ` · ${t('Your best')}: ${Math.max(best.score, score)}/${best.total}` : ''}</p>
            {save.state === 'saving' && <p className="small muted" role="status">{t('Saving your score…')}</p>}
            {save.state === 'saved' && <p className="small okc" role="status">✓ {t('Score saved. Your teacher and parents can see it.')}</p>}
            {save.state === 'error' && (
              <p className="small bad" role="alert">{t('Your score could not be saved.')} {save.text} <button type="button" className="link" onClick={() => finish(answers)}>{t('Try again')}</button></p>
            )}
            {preview && <p className="small muted">{t('Preview only: this score is not saved.')}</p>}
          </div>
        </div>
        <div className="row wrap">
          <button type="button" className="btn primary" onClick={again}>{t('Play again')}</button>
          <button type="button" className="btn" onClick={onClose}>{t('Back to games')}</button>
        </div>
        <h3>{t('Review')}</h3>
        <ol className="g-review">
          {items.map((it, i) => {
            const got = itemScore(it, answers[i]); const max = itemMax(it);
            return (
              <li key={i} className={got === max ? 'g-good' : 'g-miss'}>
                <div className="row between"><span lang="ta" className="g-rq">{it.q}</span><span className="g-pts">{got}/{max}</span></div>
                {it.sub && <p lang="ta" className="g-rsub">{it.sub}</p>}
                <Key item={it} />
                <p className="small muted">{pick(it, 'why')}</p>
              </li>
            );
          })}
        </ol>
      </section>
    );
  }

  const Body = BODY[item.t];
  return (
    <section className="card game">
      {head}
      <div className="g-prog">
        <div className="g-bar" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={idx + (answered ? 1 : 0)}>
          <span style={{ width: `${((idx + (answered ? 1 : 0)) / items.length) * 100}%` }} />
        </div>
        <span className="small muted">{t('Question {n} of {max}', { n: idx + 1, max: items.length })} · {t('Score: {n}', { n: sofar.score })}</span>
      </div>
      <p lang="ta" className="g-q">{item.q}</p>
      {item.sub && <blockquote lang="ta" className="g-sub">{item.sub}</blockquote>}
      <Body key={`${run}-${idx}`} item={item} done={answered} onAnswer={answer} />
      {answered && (
        <>
          <Feedback item={item} got={itemScore(item, answers[idx])} />
          <div className="row"><button type="button" className="btn primary big" autoFocus onClick={next}>{idx + 1 < items.length ? t('Next') : t('See my score')}</button></div>
        </>
      )}
    </section>
  );
}
