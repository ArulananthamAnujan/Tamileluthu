import React, { useEffect, useMemo, useState } from 'react';
import { WORDS, wordOfDay, kuralOfWeek, dayNumber } from './words.js';
import { t } from '../i18n.js';
import { buzz } from './isApp.js';
import Icon from '../components/Icon.jsx';

const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch { return {}; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

function speak(text) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ta-IN'; u.rate = 0.8;
    const v = speechSynthesis.getVoices().find((x) => x.lang?.startsWith('ta'));
    if (v) u.voice = v;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch { /* speech not available */ }
}

// Daily streak of answering the word quiz, per person on this device.
export function useStreak(userId) {
  const key = `tt-streak-${userId}`;
  const [s, setS] = useState(() => load(key));
  useEffect(() => {
    const sync = () => setS(load(key));
    window.addEventListener('tt-streak', sync);
    return () => window.removeEventListener('tt-streak', sync);
  }, [key]);
  const today = dayNumber();
  const alive = s.last === today || s.last === today - 1;
  const record = (correct) => {
    if (s.last === today) return;
    const next = { last: today, streak: (alive ? s.streak || 0 : 0) + 1, best: 0, correct: (s.correct || 0) + (correct ? 1 : 0), answer: correct };
    next.best = Math.max(next.streak, s.best || 0);
    save(key, next); setS(next); window.dispatchEvent(new Event('tt-streak'));
  };
  return { streak: alive ? s.streak || 0 : 0, best: s.best || 0, doneToday: s.last === today, lastCorrect: s.answer, record };
}

export default function WordOfDay({ userId, who }) {
  const word = wordOfDay();
  const { streak, best, doneToday, lastCorrect, record } = useStreak(userId);
  const [picked, setPicked] = useState(null);
  const [extra, setExtra] = useState(null);
  const current = extra || word;
  // Three meanings to choose from, always in the same order for the same word.
  const options = useMemo(() => {
    const i = WORDS.indexOf(current);
    const others = [WORDS[(i + 7) % WORDS.length], WORDS[(i + 19) % WORDS.length]];
    const all = [current, ...others].map((w) => w[2]);
    const r = (i * 31) % 3;
    return [...all.slice(r), ...all.slice(0, r)];
  }, [current]);
  const answered = picked != null || (doneToday && !extra);
  const correct = picked != null ? picked === current[2] : lastCorrect;

  function choose(o) {
    if (answered) return;
    setPicked(o); buzz(o === current[2] ? 10 : [20, 40, 20]);
    if (!extra) record(o === current[2]);
  }

  return (
    <section className="ax-card word">
      <div className="row between">
        <span className="ax-kicker">{extra ? t('Practice word') : t('Word of the day')} · இன்றைய சொல்</span>
        <span className={'streak' + (streak ? ' on' : '')} title={t('Best streak: {n} days', { n: best })}>🔥 {streak}</span>
      </div>
      <div className="word-main">
        <b lang="ta">{current[0]}</b>
        <button className="speak" onClick={() => speak(current[0])} aria-label={t('Hear it')}><Icon name="listening" size={18} /></button>
      </div>
      <p className="word-say">{current[1]}</p>
      {answered ? (
        <div className={'word-result ' + (correct ? 'yes' : 'no')}>
          <b>{correct ? t('Correct! நன்று!') : t('Good try!')}</b>
          <span>{current[0]} = <b>{current[2]}</b></span>
          {!extra && <small>{streak > 1 ? t('{n}-day streak. Come back tomorrow!', { n: streak }) : t('Come back tomorrow for a new word.')}</small>}
          <button className="btn small" onClick={() => { setExtra(WORDS[Math.floor(Math.random() * WORDS.length)]); setPicked(null); }}>{t('Practise another word')}</button>
        </div>
      ) : (
        <>
          <p className="small muted">{who ? t('What does it mean? Ask {name} too!', { name: who }) : t('What does it mean?')}</p>
          <div className="word-opts">{options.map((o) => <button key={o} onClick={() => choose(o)}>{o}</button>)}</div>
        </>
      )}
    </section>
  );
}

export function KuralCard() {
  const [a, b, n, meaning] = kuralOfWeek();
  return (
    <section className="ax-card kural">
      <span className="ax-kicker">{t('Thirukkural of the week')} · திருக்குறள் {n}</span>
      <blockquote lang="ta"><span>{a}</span><span>{b}</span></blockquote>
      <p className="small">{meaning}</p>
      <button className="link small" onClick={() => speak(`${a} ${b}`)}>{t('Hear it')} ▸</button>
    </section>
  );
}
