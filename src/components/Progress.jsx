import React from 'react';
import { t } from '../i18n.js';
import { GROUPS, CATS, tally } from '../categories.js';

// Mistake totals and the most common mistakes across many pieces of writing.
export default function Progress({ subs, title = t('Most common mistakes') }) {
  const checked = subs.filter((s) => s.status === 'checked');
  const tot = tally(checked);
  if (!checked.length) return null;
  const max = tot.top[0]?.[1] || 1;
  return (
    <section className="card">
      <h3>{t(title)}</h3>
      <p className="muted small">{t('{a} checked pieces · {b} mistakes', { a: checked.length, b: tot.total })}</p>
      <div className="chips">
        {Object.entries(GROUPS).map(([g, v]) => <span key={g} className="chip"><span className={`dot d-${g}`} />{t(v.label)} <b>{tot.groups[g]}</b></span>)}
      </div>
      <div className="bars">
        {tot.top.slice(0, 6).map(([k, n]) => (
          <div key={k} className="barrow">
            <span className="blabel">{CATS[k].label}</span>
            <span className="btrack"><span className={`bfill d-${CATS[k].g}`} style={{ width: `${(n / max) * 100}%` }} /></span>
            <b className="bnum">{n}</b>
          </div>
        ))}
      </div>
    </section>
  );
}
