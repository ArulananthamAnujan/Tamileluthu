import React, { useState } from 'react';
import { supabase, errText, fnErrText } from '../supabase.js';
import { t, getLang } from '../i18n.js';
import Icon from './Icon.jsx';

export const CRITERIA = {
  relevance: { en: 'Answering the question', ta: 'வினாவுக்கான பொருத்தம்' },
  structure: { en: 'Structure', ta: 'கட்டமைப்பு' },
  accuracy: { en: 'Language accuracy', ta: 'மொழிச் சரிநுட்பம்' },
  vocabulary: { en: 'Vocabulary & expression', ta: 'சொல்வளம்' },
  conventions: { en: 'Text type & register', ta: 'எழுத்து வகை' },
};
export const SECTIONS = [
  ['introduction', 'Introduction', 'முன்னுரை'],
  ['body', 'Body', 'பொருளுரை'],
  ['conclusion', 'Conclusion', 'முடிவுரை'],
];
const STATUS = {
  answered: { cls: 'yes', en: 'Answers the question', ta: 'வினாவுக்கு விடையளிக்கிறது' },
  partly_answered: { cls: 'part', en: 'Partly answers the question', ta: 'வினாவுக்குப் பகுதியளவில் விடையளிக்கிறது' },
  not_answered: { cls: 'no', en: 'Does not answer the question', ta: 'வினாவுக்கு விடையளிக்கவில்லை' },
  no_question: { cls: 'ask', en: 'Question not given', ta: 'வினா தரப்படவில்லை' },
};
const both = (o) => (getLang() === 'ta' ? `${o.ta} · ${o.en}` : `${o.en} · ${o.ta}`);

export const grade = (pct) => (pct >= 85 ? 'A+' : pct >= 75 ? 'A' : pct >= 65 ? 'B' : pct >= 55 ? 'C' : pct >= 45 ? 'D' : 'E');

// Examiner-style feedback: question check, introduction/body/conclusion, practice mark.
export default function EssayFeedback({ sub, canEdit, onRechecked }) {
  const e = sub.essay;
  const [q, setQ] = useState(sub.question || e?.inferred_question || '');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!e) return null;
  const st = STATUS[e.question_status] || STATUS.no_question;
  const pct = e.max ? Math.round((e.total / e.max) * 100) : null;

  async function recheck(question) {
    setBusy(true); setMsg('');
    const { error } = await supabase.rpc('set_question', { sub: sub.id, q: question });
    if (error) { setMsg(t(errText(error))); setBusy(false); return; }
    const { error: fErr } = await supabase.functions.invoke('check-writing', { body: { submission_id: sub.id } });
    if (fErr) setMsg(t(await fnErrText(fErr, 'check-writing')));
    setBusy(false); setEditing(false);
    onRechecked?.();
  }

  return (
    <section className="card essay">
      <div className="essay-head">
        <div>
          <span className="kicker">{t('Examiner’s feedback')} · மதிப்பீட்டாளர் கருத்து</span>
          <h3>{t('How your essay is marked')}</h3>
        </div>
        {pct != null && (
          <div className="essay-mark" title={t('Practice mark, not an official exam mark')}>
            <b>{e.total}<small>/{e.max}</small></b>
            <span>{pct}% · {grade(pct)}</span>
          </div>
        )}
      </div>

      <div className={`qcheck ${st.cls}`}>
        <div className="qcheck-top"><b>{both(st)}</b></div>
        {sub.question && <p className="small"><span className="muted">{t('Question')}:</span> <span lang="ta">{sub.question}</span></p>}
        {e.question_feedback && <p>{e.question_feedback}</p>}
        {e.inferred_question && (
          <p className="inferred"><span className="muted small">{sub.question ? t('Your writing seems to answer this question instead:') : t('Your answer reflects this type of question:')}</span><br /><b lang="ta">{e.inferred_question}</b></p>
        )}
        {canEdit && (e.question_status === 'no_question' || e.question_status === 'not_answered' || editing) && (
          editing ? (
            <form className="form" onSubmit={(ev) => { ev.preventDefault(); recheck(q); }}>
              <label className="field">{t('Type the exact question or task you were given')}
                <textarea rows={3} value={q} maxLength={2000} onChange={(ev) => setQ(ev.target.value)} lang="ta" />
              </label>
              <div className="row wrap">
                <button className="btn primary" disabled={busy || !q.trim()}>{busy ? t('Checking…') : t('Save and mark again')}</button>
                <button type="button" className="btn" onClick={() => setEditing(false)}>{t('Cancel')}</button>
              </div>
            </form>
          ) : (
            <div className="row wrap">
              {e.question_status === 'no_question' && e.inferred_question && (
                <button className="btn primary small" disabled={busy} onClick={() => recheck(e.inferred_question)}>
                  <Icon name="check" size={15} stroke={2.4} />{busy ? t('Checking…') : t('Yes, that is my question')}</button>
              )}
              <button className="btn small" onClick={() => { setQ(sub.question || ''); setEditing(true); }}>{t('Enter the real question')}</button>
            </div>
          )
        )}
        {canEdit && !editing && e.question_status !== 'no_question' && e.question_status !== 'not_answered' && (
          <button className="link small" onClick={() => { setQ(sub.question || ''); setEditing(true); }}>{t('Change the question')}</button>
        )}
        {msg && <p className="small" role="status">{msg}</p>}
      </div>

      <div className="sections">
        {SECTIONS.map(([k, en, ta]) => {
          const s = e.sections?.[k];
          if (!s) return null;
          return (
            <article key={k} className={'esec' + (s.present ? '' : ' missing')}>
              <h4>{getLang() === 'ta' ? `${ta} · ${en}` : `${en} · ${ta}`}{!s.present && <span className="tag k-announcement">{t('Missing')}</span>}</h4>
              {s.what_you_wrote && <p className="small wyw"><span className="muted">{t('What you wrote')}:</span> {s.what_you_wrote}</p>}
              {s.strengths?.length > 0 && <ul className="good">{s.strengths.map((x, i) => <li key={i}><Icon name="check" size={14} stroke={2.6} />{x}</li>)}</ul>}
              {s.improvements?.length > 0 && <ul className="improve">{s.improvements.map((x, i) => <li key={i}><Icon name="arrow" size={14} />{x}</li>)}</ul>}
              {s.example && <p className="model" lang="ta"><span className="muted small">{t('Model sentence')}:</span><br />{s.example}</p>}
            </article>
          );
        })}
      </div>

      {e.rubric?.length > 0 && (
        <div className="rubric">
          <h4>{t('Marking criteria')} · மதிப்பீட்டு அளவுகோல்கள்</h4>
          {e.rubric.map((r) => (
            <div key={r.criterion} className="rrow">
              <span className="rname">{both(CRITERIA[r.criterion] || { en: r.criterion, ta: '' })}</span>
              <span className="rdots" aria-label={`${r.score}/5`}>{[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= r.score ? 'on' : ''} />)}</span>
              <b className="rscore">{r.score}/5</b>
              {r.comment && <span className="rcomment small">{r.comment}</span>}
            </div>
          ))}
          <p className="small muted">{t('Practice mark, not an official exam mark')}</p>
        </div>
      )}

      {e.text_type_feedback && <div className="essay-block"><h4>{t('Text type')} · எழுத்து வகை</h4><p>{e.text_type_feedback}</p></div>}
      {e.overall && <div className="essay-block"><h4>{t('Overall')} · ஒட்டுமொத்தம்</h4><p>{e.overall}</p></div>}
      {e.next_steps?.length > 0 && (
        <div className="essay-block"><h4>{t('Next steps')} · அடுத்த படிகள்</h4><ol>{e.next_steps.map((x, i) => <li key={i}>{x}</li>)}</ol></div>
      )}
      {e.useful_phrases?.length > 0 && (
        <div className="essay-block"><h4>{t('Useful phrases')} · பயனுள்ள தொடர்கள்</h4>
          <ul className="phrases">{e.useful_phrases.map((p, i) => <li key={i}><b lang="ta">{p.tamil}</b><span className="small muted">{p.meaning}</span></li>)}</ul>
        </div>
      )}
    </section>
  );
}
