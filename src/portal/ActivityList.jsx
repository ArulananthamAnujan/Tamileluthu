import React from 'react';
import { ACTIVITY_KINDS } from '../site.js';
import { fmtDay, isoDay, safeUrl } from '../lib/util.js';
import { t, tl } from '../i18n.js';
import WaButton from '../components/Wa.jsx';
import { siteLink } from '../lib/wa.js';
import { YouTube, Files } from '../components/Attachments.jsx';

export function activityText(a, className) {
  const k = ACTIVITY_KINDS[a.kind] || ACTIVITY_KINDS.homework;
  return [`${k.en} · ${k.ta}${className ? ` — ${className}` : ''}`, `*${a.title}*`, a.body, a.due_on ? `Due / கடைசி நாள்: ${fmtDay(a.due_on)}` : '', safeUrl(a.link_url) || '',
    a.copy_work ? `✍ Copy writing / பார்த்து எழுதுதல்: ${a.copy_work}` : '',
    a.reading_work ? `📖 Reading comprehension / வாசிப்புப் புரிதல்: ${a.reading_work}` : '',
    a.presenter_name ? `🎤 Presentation / முன்வைப்பு: ${a.presenter_name}${a.presentation_topic ? ` (${a.presentation_topic})` : ''}` : '',
    a.video_url ? `Video / காணொளி: ${a.video_url}` : '',
    a.attachments?.length ? `Files / கோப்புகள்: ${a.attachments.map((f) => f.name).join(', ')}` : '', siteLink('diary')]
    .filter(Boolean).join('\n');
}

// One diary entry per row. Students can tick homework done; teachers can edit/delete.
export default function ActivityList({ items, classNames = {}, done = {}, onToggle, onEdit, onDelete, onNotify, empty, showClass, share, studentId }) {
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
            {(a.copy_work || a.reading_work || a.presenter_name) && (
              <div className="hw-parts">
                {a.copy_work && <div className="hw-part"><b>{t('Copy writing')} <span className="ta">· பார்த்து எழுதுதல்</span></b><p>{a.copy_work}</p></div>}
                {a.reading_work && <div className="hw-part"><b>{t('Reading comprehension')} <span className="ta">· வாசிப்புப் புரிதல்</span></b><p>{a.reading_work}</p></div>}
                {a.presenter_name && (
                  <div className={'hw-part pres' + (studentId && a.presenter_id === studentId ? ' me' : '')}>
                    <b>{t('Presentation this week')} <span className="ta">· முன்வைப்பு</span></b>
                    <p><span className="pres-name">{a.presenter_name}</span>{a.presentation_topic ? ` · ${a.presentation_topic}` : ''}</p>
                    {studentId && a.presenter_id === studentId && <p className="small">{t('It is your turn to present this week.')}</p>}
                  </div>
                )}
              </div>
            )}
            {link && <p className="small"><a href={link} target="_blank" rel="noopener noreferrer">{t('Open link')} ↗</a></p>}
            {a.video_url && <YouTube url={a.video_url} title={a.title} />}
            <Files files={a.attachments} />
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
