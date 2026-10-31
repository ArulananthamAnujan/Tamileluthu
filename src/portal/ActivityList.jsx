import React from 'react';
import { ACTIVITY_KINDS } from '../site.js';
import { fmtDay, isoDay, safeUrl } from '../lib/util.js';
import { t, tl } from '../i18n.js';
import WaButton from '../components/Wa.jsx';
import { siteLink } from '../lib/wa.js';

export function activityText(a, className) {
  const k = ACTIVITY_KINDS[a.kind] || ACTIVITY_KINDS.homework;
  return [`${k.en} · ${k.ta}${className ? ` — ${className}` : ''}`, `*${a.title}*`, a.body, a.due_on ? `Due / கடைசி நாள்: ${fmtDay(a.due_on)}` : '', safeUrl(a.link_url) || '', siteLink('diary')]
    .filter(Boolean).join('\n');
}

// One diary entry per row. Students can tick homework done; teachers can edit/delete.
export default function ActivityList({ items, classNames = {}, done = {}, onToggle, onEdit, onDelete, onNotify, empty, showClass, share }) {
  if (!items.length) return <p className="muted">{empty || t('Nothing here yet.')}</p>;
  const today = isoDay();
  return (
    <ul className="acts">
      {items.map((a) => {
        const k = ACTIVITY_KINDS[a.kind] || ACTIVITY_KINDS.homework;
        const overdue = a.kind === 'homework' && a.due_on && a.due_on < today && done[a.id] === false;
        const link = safeUrl(a.link_url);
        return (
          <li key={a.id} className={`act k-${a.kind}`}>
            <div className="act-head">
              <span className={`tag k-${a.kind}`}>{tl(k)}</span>
              <span className="small muted">{fmtDay(a.on_date)}{showClass && classNames[a.class_id] ? ` · ${classNames[a.class_id]}` : ''}</span>
              {a.due_on && <span className={'small ' + (overdue ? 'bad' : 'muted')}>{a.kind === 'event' ? '' : t('Due')} {fmtDay(a.due_on)}</span>}
            </div>
            <p className="act-title">{a.title}</p>
            {a.body && <p className="act-body">{a.body}</p>}
            {link && <p className="small"><a href={link} target="_blank" rel="noopener noreferrer">{t('Open link')} ↗</a></p>}
            <div className="row wrap act-foot">
              {onToggle && a.kind === 'homework' && (
                <label className="row small check">
                  <input type="checkbox" checked={Boolean(done[a.id])} onChange={() => onToggle(a)} /> {t('Done')}
                </label>
              )}
              {!onToggle && done[a.id] !== undefined && a.kind === 'homework' && (
                <span className={'small ' + (done[a.id] ? 'okc' : 'muted')}>{done[a.id] ? `✓ ${t('Marked done')}` : t('Not done yet')}</span>
              )}
              {typeof a.doneCount === 'number' && <span className="small muted">{t('{n} done', { n: a.doneCount })}</span>}
              {share && <WaButton text={activityText(a, classNames[a.class_id])} />}
              {onNotify && <button className="btn small" onClick={() => onNotify(a)}>{a.notified_at ? t('Email parents again') : t('Email parents')}</button>}
              {onEdit && <button className="btn small" onClick={() => onEdit(a)}>{t('Edit')}</button>}
              {onDelete && <button className="btn small" onClick={() => onDelete(a)}>{t('Delete')}</button>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
