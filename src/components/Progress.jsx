import React from 'react';
import { GROUPS, CATS, tally } from '../categories.js';

// Mistake totals and the most common mistakes across many pieces of writing.
export default function Progress({ subs, title = 'Most common mistakes' }) {
  const checked = subs.filter((s) => s.status === 'checked');
  const t = tally(checked);
  if (!checked.length) return null;
  const max = t.top[0]?.[1] || 1;
  return (
    <section className="card">
      <h3>{title}</h3>
      <p className="muted small">{checked.length} checked piece{checked.length > 1 ? 's' : ''} · {t.total} mistakes</p>
      <div className="chips">
        {Object.entries(GROUPS).map(([g, v]) => <span key={g} className="chip"><span className={`dot d-${g}`} />{v.label} <b>{t.groups[g]}</b></span>)}
      </div>
      <div className="bars">
        {t.top.slice(0, 6).map(([k, n]) => (
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
