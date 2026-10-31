import React, { useEffect, useState } from 'react';
import { supabase, errText } from '../supabase.js';
import { fmtDay, isoDay, safeUrl, go } from '../lib/util.js';
import { RESOURCE_KINDS } from '../site.js';
import { NeedsSetup } from './Setup.jsx';
import { t, tl } from '../i18n.js';
import WaButton from '../components/Wa.jsx';
import { siteLink } from '../lib/wa.js';

const blank = () => ({ kind: 'listening', title: '', description: '', url: '', answers_url: '', show_answers: false, due_on: '' });

// Listening exams and other links (audio, past papers, videos) for a class.
export default function Resources({ ctx }) {
  const [items, setItems] = useState(null);
  const [marks, setMarks] = useState({});
  const [kind, setKind] = useState('listening');
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');
  const teacher = ctx.role === 'teacher';

  async function load() {
    if (!ctx.classIds.length) return;
    let q = supabase.from('resources').select('*').in('class_id', ctx.classIds).order('created_at', { ascending: false });
    if (kind !== 'all') q = q.eq('kind', kind);
    const { data } = await q;
    setItems(data || []);
    if (!teacher && data?.length) {
      const { data: m } = await supabase.from('marks').select('mark, absent, assessment:assessments(resource_id, max_mark)').eq('student_id', ctx.studentId);
      const by = {}; (m || []).forEach((x) => { if (x.assessment?.resource_id) by[x.assessment.resource_id] = x; });
      setMarks(by);
    }
  }
  useEffect(() => { load(); }, [kind]);
  if (!ctx.classIds.length) return <NeedsSetup ctx={ctx} />;

  async function save(e) {
    e.preventDefault(); setMsg('');
    const row = {
      kind: form.kind, title: form.title.trim(), description: form.description.trim(), url: form.url.trim(),
      answers_url: form.answers_url.trim() || null, show_answers: form.show_answers, due_on: form.due_on || null,
    };
    if (!row.title || !safeUrl(row.url)) { setMsg(t('Add a title and a link starting with https://')); return; }
    if (row.answers_url && !safeUrl(row.answers_url)) { setMsg(t('The answers link must start with https://')); return; }
    const { error } = editing
      ? await supabase.from('resources').update(row).eq('id', editing)
      : await supabase.from('resources').insert({ ...row, class_id: ctx.cls.id, created_by: ctx.profile.id });
    if (error) { setMsg(errText(error)); return; }
    setForm(blank()); setEditing(null); setMsg(t('Saved.')); setKind(row.kind); load();
  }
  async function remove(r) {
    if (!confirm(t('Delete “{title}”?', { title: r.title }))) return;
    await supabase.from('resources').delete().eq('id', r.id); load();
  }
  async function toggleAnswers(r) {
    await supabase.from('resources').update({ show_answers: !r.show_answers }).eq('id', r.id); load();
  }
  async function markSheet(r) {
    const { data: existing } = await supabase.from('assessments').select('id').eq('resource_id', r.id).limit(1);
    if (existing?.length) { go(`marks?a=${existing[0].id}`); return; }
    const { data, error } = await supabase.from('assessments').insert({
      class_id: ctx.cls.id, title: r.title, kind: r.kind === 'listening' ? 'listening' : r.kind === 'reading' ? 'reading' : 'test',
      max_mark: 20, held_on: r.due_on || isoDay(), resource_id: r.id, created_by: ctx.profile.id,
    }).select('id').single();
    if (error) { setMsg(errText(error)); return; }
    go(`marks?a=${data.id}`);
  }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div className="stack">
      <div className="row between wrap">
        <h2 className="title">{t('Listening & resources')} <span className="ta">· கேட்டல் தேர்வுகள்</span></h2>
        <div className="tabs">
          {[['listening', t('Listening')], ['all', t('All')], ...Object.entries(RESOURCE_KINDS).filter(([k]) => k !== 'listening').map(([k, v]) => [k, tl(v)])].map(([k, l]) => (
            <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className={teacher ? 'grid2' : ''}>
        <section className="stack">
          {!items ? <p className="muted">{t('Loading…')}</p> : !items.length ? (
            <div className="card"><p className="muted">{teacher ? t('Add a link to a listening exam (YouTube, Google Drive audio, a practice listening paper…).') : t('No listening exams posted yet.')}</p></div>
          ) : (
            <div className="cards">
              {items.map((r) => {
                const m = marks[r.id];
                return (
                  <article key={r.id} className="card res">
                    <span className="tag">{tl(RESOURCE_KINDS[r.kind])}</span>
                    <h3>{r.title}</h3>
                    {r.description && <p className="small pre">{r.description}</p>}
                    <p className="small muted">{t('Posted')} {fmtDay(r.created_at.slice(0, 10))}{r.due_on ? ` · ${t('Due')} ${fmtDay(r.due_on)}` : ''}</p>
                    <div className="row wrap">
                      <a className="btn primary small" href={safeUrl(r.url)} target="_blank" rel="noopener noreferrer">{r.kind === 'listening' ? `▶ ${t('Start listening')}` : `${t('Open')} ↗`}</a>
                      {r.answers_url && (teacher || r.show_answers) && <a className="btn small" href={safeUrl(r.answers_url)} target="_blank" rel="noopener noreferrer">{t('Answers')} ↗</a>}
                      {m && <span className="chip">{m.absent ? t('Absent') : m.mark == null ? '–' : <>{t('Mark')} <b>{Number(m.mark)}/{Number(m.assessment.max_mark)}</b></>}</span>}
                      {teacher && <WaButton text={`${tl(RESOURCE_KINDS[r.kind])}: *${r.title}*\n${r.description ? r.description + '\n' : ''}${r.url}\n${siteLink('listening')}`} />}
                    </div>
                    {teacher && (
                      <div className="row wrap act-foot">
                        <button className="btn small" onClick={() => markSheet(r)}>{t('Enter marks')}</button>
                        {r.answers_url && <button className="btn small" onClick={() => toggleAnswers(r)}>{r.show_answers ? t('Hide answers') : t('Show answers to students')}</button>}
                        <button className="btn small" onClick={() => { setEditing(r.id); setForm({ ...blank(), ...r, answers_url: r.answers_url || '', due_on: r.due_on || '' }); }}>{t('Edit')}</button>
                        <button className="btn small" onClick={() => remove(r)}>{t('Delete')}</button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
        {teacher && (
          <aside className="card">
            <h3>{editing ? t('Edit link') : t('Add a listening exam or link')}</h3>
            <form className="form" onSubmit={save}>
              <label className="field">{t('Type')}
                <select value={form.kind} onChange={set('kind')}>{Object.entries(RESOURCE_KINDS).map(([k, v]) => <option key={k} value={k}>{tl(v)}</option>)}</select>
              </label>
              <label className="field">{t('Title')}<input value={form.title} onChange={set('title')} maxLength={200} placeholder={t('e.g. Listening practice 3 – Interview')} /></label>
              <label className="field">{t('Exam / audio link')}<input value={form.url} onChange={set('url')} placeholder="https://" inputMode="url" /></label>
              <label className="field">{t('Instructions')}<textarea rows={3} value={form.description} onChange={set('description')} maxLength={3000} placeholder={t('Listen twice. Answer in Tamil.')} /></label>
              <label className="field">{t('Answers link (optional)')}<input value={form.answers_url} onChange={set('answers_url')} placeholder="https://" inputMode="url" /></label>
              <label className="row small check"><input type="checkbox" checked={form.show_answers} onChange={set('show_answers')} /> {t('Show answers to students now')}</label>
              <label className="field">{t('Due (optional)')}<input type="date" value={form.due_on || ''} onChange={set('due_on')} /></label>
              {msg && <p className="small" role="status">{msg}</p>}
              <div className="row">
                <button className="btn primary">{editing ? t('Save') : t('Add')}</button>
                {editing && <button type="button" className="btn" onClick={() => { setEditing(null); setForm(blank()); }}>{t('Cancel')}</button>}
              </div>
              <p className="muted small">{t('After the exam, press “Enter marks” to record scores and send them to parents.')}</p>
            </form>
          </aside>
        )}
      </div>
    </div>
  );
}
