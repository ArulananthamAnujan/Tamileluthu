import React from 'react';
import { t } from '../i18n.js';
import { GROUPS, catOf, typeLabel, fmtDate } from '../categories.js';

const STATUS = { pending: 'Waiting', checking: 'Checking…', checked: 'Checked', error: 'Check failed' };

export default function SubmissionList({ subs, onOpen, empty }) {
  if (!subs.length) return <p className="muted">{empty}</p>;
  return (
    <div className="sublist">
      {subs.map((s) => {
        const c = { spell: 0, sandhi: 0, gram: 0, style: 0 };
        (s.issues || []).forEach((i) => c[catOf(i).g]++);
        return (
          <button key={s.id} className="subrow" onClick={() => onOpen(s)}>
            <span className="subtitle">{s.title || t('Untitled writing')}</span>
            <span className="muted small">{typeLabel(s.text_type)} · {fmtDate(s.created_at)}{s.teacher_comment ? ` · ${t('Teacher commented')}` : ''}</span>
            <span className="subcounts">
              <span className={`status s-${s.status}`}>{t(STATUS[s.status])}</span>
              {s.status === 'checked' && Object.keys(GROUPS).map((g) => (
                <span key={g} className="mini" title={t(GROUPS[g].label)}><span className={`dot d-${g}`} />{c[g]}</span>
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
