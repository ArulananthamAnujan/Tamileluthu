import React from 'react';
import { ACTIVITY_KINDS } from '../site.js';
import { fmtDay, isoDay, safeUrl } from '../lib/util.js';

// One diary entry per row. Students can tick homework done; teachers can edit/delete.
export default function ActivityList({ items, classNames = {}, done = {}, onToggle, onEdit, onDelete, onNotify, empty, showClass }) {
  if (!items.length) return <p className="muted">{empty || 'Nothing here yet.'}</p>;
  const today = isoDay();
  return (
    <ul className="acts">
      {items.map((a) => {
        const k = ACTIVITY_KINDS[a.kind] || ACTIVITY_KINDS.homework;
        const overdue = a.kind === 'homework' && a.due_on && a.due_on < today && done[a.id] === undefined;
        const link = safeUrl(a.link_url);
        return (
          <li key={a.id} className={`act k-${a.kind}`}>
            <div className="act-head">
              <span className={`tag k-${a.kind}`}>{k.label} · {k.ta}</span>
              <span className="small muted">{fmtDay(a.on_date)}{showClass && classNames[a.class_id] ? ` · ${classNames[a.class_id]}` : ''}</span>
              {a.due_on && <span className={'small ' + (overdue ? 'bad' : 'muted')}>Due {fmtDay(a.due_on)}</span>}
            </div>
            <p className="act-title">{a.title}</p>
            {a.body && <p className="act-body">{a.body}</p>}
            {link && <p className="small"><a href={link} target="_blank" rel="noopener noreferrer">Open link ↗</a></p>}
            <div className="row wrap act-foot">
              {onToggle && a.kind === 'homework' && (
                <label className="row small check">
                  <input type="checkbox" checked={Boolean(done[a.id])} onChange={() => onToggle(a)} /> Done
                </label>
              )}
              {!onToggle && done[a.id] !== undefined && a.kind === 'homework' && (
                <span className={'small ' + (done[a.id] ? 'okc' : 'muted')}>{done[a.id] ? '✓ Marked done' : 'Not done yet'}</span>
              )}
              {typeof a.doneCount === 'number' && <span className="small muted">{a.doneCount} done</span>}
              {onNotify && <button className="btn small" onClick={() => onNotify(a)}>{a.notified_at ? 'Email parents again' : 'Email parents'}</button>}
              {onEdit && <button className="btn small" onClick={() => onEdit(a)}>Edit</button>}
              {onDelete && <button className="btn small" onClick={() => onDelete(a)}>Delete</button>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
