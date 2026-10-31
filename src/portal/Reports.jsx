import React, { useEffect, useRef, useState } from 'react';
import { supabase, errText } from '../supabase.js';
import { useRoster, useParents, callFn } from '../lib/scope.js';
import { t, tl, getLang } from '../i18n.js';
import WaButton from '../components/Wa.jsx';
import { siteLink } from '../lib/wa.js';
import { fmtDay, isoDay, pct } from '../lib/util.js';
import { SKILLS, RATINGS, RATING_TA, ASSESSMENT_KINDS, ATTENDANCE, SITE } from '../site.js';
import { NeedsSetup } from './Setup.jsx';
import PdfShare from '../components/PdfShare.jsx';

const rt = (r) => (getLang() === 'ta' ? `${RATING_TA[r]} · ${r}` : r);

function defaultTerm() {
  const d = new Date(); const q = Math.floor(d.getMonth() / 3);
  const y = d.getFullYear();
  const start = isoDay(new Date(y, q * 3, 1)), end = isoDay(new Date(y, q * 3 + 3, 0));
  return { term: `Term ${q + 1} ${y}`, start, end };
}

export default function Reports({ ctx }) {
  if (!ctx.classIds.length) return <NeedsSetup ctx={ctx} />;
  return ctx.role === 'teacher' ? <TeacherReports ctx={ctx} /> : <MyReports ctx={ctx} />;
}

function TeacherReports({ ctx }) {
  const { cls } = ctx;
  const roster = useRoster(cls.id);
  const parents = useParents(roster.map((s) => s.id));
  const def = defaultTerm();
  const [term, setTerm] = useState(def.term);
  const [reports, setReports] = useState([]);
  const [student, setStudent] = useState(null);
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from('reports').select('*').eq('class_id', cls.id).eq('term', term.trim());
    setReports(data || []);
  }
  useEffect(() => { load(); }, [cls.id, term]);
  const byStudent = Object.fromEntries(reports.map((r) => [r.student_id, r]));

  if (preview) return <ReportCard report={preview} studentName={roster.find((s) => s.id === preview.student_id)?.full_name} className={cls.name} teacher={ctx.profile.full_name} onBack={() => setPreview(null)} />;
  if (student) return <ReportEditor ctx={ctx} student={student} term={term.trim()} defaults={def} existing={byStudent[student.id]}
    onBack={() => { setStudent(null); load(); }} onPreview={(r) => { setStudent(null); setPreview(r); load(); }} />;

  async function sendAll() {
    const ready = reports.filter((r) => !r.notified_at);
    if (!ready.length) { setMsg(t('Every report for this term has already been sent.')); return; }
    if (!confirm(t('Publish and email {n} reports to parents?', { n: ready.length }))) return;
    setBusy(true); let sent = 0; let note = '';
    for (const r of ready) {
      try { const x = await callFn('notify-parents', { kind: 'report', id: r.id }); sent += x.sent || 0; note = x.note || note; }
      catch (e) { note = e.message; }
    }
    setBusy(false); setMsg(note ? t(note) : t('Sent {n} emails.', { n: sent })); load();
  }

  return (
    <div className="stack">
      <div className="row between wrap">
        <h2 className="title">{t('Reports')} <span className="ta">· தேர்ச்சி அறிக்கை</span></h2>
        <label className="row small">{t('Term')}<input value={term} onChange={(e) => setTerm(e.target.value)} maxLength={60} style={{ width: '11em' }} /></label>
      </div>
      <section className="card">
        <div className="row between wrap">
          <h3>{cls.name} · {term}</h3>
          <button className="btn small primary" onClick={sendAll} disabled={busy || !reports.length}>{t('Send all written reports to parents')}</button>
        </div>
        {msg && <p className="small" role="status">{msg}</p>}
        <div className="tablewrap">
          <table className="table">
            <thead><tr><th>{t('Student')}</th><th>{t('Status')}</th><th></th></tr></thead>
            <tbody>{roster.map((s) => {
              const r = byStudent[s.id];
              return (
                <tr key={s.id}>
                  <td>{s.full_name}</td>
                  <td>{!r ? <span className="status">{t('Not started')}</span> : r.notified_at ? <span className="status s-checked">{t('Sent')} {fmtDay(r.notified_at.slice(0, 10))}</span>
                    : r.published ? <span className="status s-checked">{t('Published')}</span> : <span className="status s-pending">{t('Draft')}</span>}</td>
                  <td className="row wrap">
                    <button className="btn small" onClick={() => setStudent(s)}>{r ? t('Edit') : t('Write report')}</button>
                    {r && <button className="btn small" onClick={() => setPreview(r)}>{t('View / print')}</button>}
                    {r?.published && (parents[s.id] || []).filter((x) => x.phone).map((x) => (
                      <WaButton key={x.id} phone={x.phone} label={x.full_name.split(' ')[0]}
                        text={t('Hello {parent}, {child}’s {term} report is ready: {url}', { parent: x.full_name, child: s.full_name, term, url: siteLink('reports') })} />
                    ))}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <p className="muted small">{t('Each report automatically includes the student’s attendance and marks for the report period. Parents only see a report after you publish or send it.')}</p>
      </section>
    </div>
  );
}

function ReportEditor({ ctx, student, term, defaults, existing, onBack, onPreview }) {
  const [f, setF] = useState(() => ({
    period_start: existing?.period_start || defaults.start, period_end: existing?.period_end || defaults.end,
    skills: existing?.skills || {}, effort: existing?.effort || '', behaviour: existing?.behaviour || '',
    strengths: existing?.strengths || '', next_steps: existing?.next_steps || '', comment: existing?.comment || '',
  }));
  const [id, setId] = useState(existing?.id || null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setSkill = (k, v) => setF((x) => ({ ...x, skills: { ...x.skills, [k]: v } }));

  async function save(extra = {}) {
    setMsg(''); setBusy(true);
    const row = {
      term, period_start: f.period_start || null, period_end: f.period_end || null, skills: f.skills,
      effort: f.effort || null, behaviour: f.behaviour || null, strengths: f.strengths.trim() || null,
      next_steps: f.next_steps.trim() || null, comment: f.comment.trim() || null, ...extra,
    };
    const res = id
      ? await supabase.from('reports').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      : await supabase.from('reports').insert({ ...row, class_id: ctx.cls.id, student_id: student.id, created_by: ctx.profile.id }).select().single();
    setBusy(false);
    if (res.error) { setMsg(errText(res.error)); return null; }
    setId(res.data.id); setMsg(t('Saved.'));
    return res.data;
  }
  async function send() {
    const r = await save();
    if (!r || !confirm(t('Publish this report and email {name}’s parents?', { name: student.full_name }))) return;
    setBusy(true);
    try { const x = await callFn('notify-parents', { kind: 'report', id: r.id }); setMsg(x.note ? t(x.note) : t('Published and emailed {n} parents.', { n: x.sent })); }
    catch (e) { setMsg(e.message); }
    setBusy(false);
  }

  return (
    <div className="stack">
      <div className="row between wrap">
        <button className="btn small" onClick={onBack}>← {t('All reports')}</button>
        <div className="row wrap">
          <button className="btn small" disabled={busy} onClick={() => save()}>{t('Save draft')}</button>
          <button className="btn small" disabled={busy} onClick={async () => { const r = await save(); if (r) onPreview(r); }}>{t('Preview')}</button>
          <button className="btn small primary" disabled={busy} onClick={send}>{t('Publish & email parents')}</button>
        </div>
      </div>
      <h2 className="title">{student.full_name} · {term}</h2>
      {msg && <p className="small" role="status">{msg}</p>}
      <div className="grid2">
        <section className="card form">
          <h3>{t('Skills')}</h3>
          <div className="skills">
            {SKILLS.map(([k, en, ta]) => (
              <label key={k} className="field">{en} · {ta}
                <select value={f.skills[k] || ''} onChange={(e) => setSkill(k, e.target.value)}>
                  <option value="">—</option>{RATINGS.map((r) => <option key={r} value={r}>{rt(r)}</option>)}
                </select>
              </label>
            ))}
            <label className="field">{t('Effort')}<select value={f.effort} onChange={set('effort')}><option value="">—</option>{RATINGS.map((r) => <option key={r} value={r}>{rt(r)}</option>)}</select></label>
            <label className="field">{t('Behaviour')}<select value={f.behaviour} onChange={set('behaviour')}><option value="">—</option>{RATINGS.map((r) => <option key={r} value={r}>{rt(r)}</option>)}</select></label>
          </div>
          <label className="field">{t('Strengths')}<textarea rows={3} value={f.strengths} onChange={set('strengths')} maxLength={2000} /></label>
          <label className="field">{t('Next steps (what to practise at home)')}<textarea rows={3} value={f.next_steps} onChange={set('next_steps')} maxLength={2000} /></label>
          <label className="field">{t('Teacher’s comment')}<textarea rows={5} value={f.comment} onChange={set('comment')} maxLength={3000} /></label>
        </section>
        <aside className="stack">
          <section className="card form">
            <h3>{t('Report period')}</h3>
            <div className="row wrap">
              <label className="field">{t('From')}<input type="date" value={f.period_start} onChange={set('period_start')} /></label>
              <label className="field">{t('To')}<input type="date" value={f.period_end} onChange={set('period_end')} /></label>
            </div>
            <p className="muted small">{t('Attendance and marks in this period are added to the report automatically.')}</p>
          </section>
          <PeriodSummary studentId={student.id} classId={ctx.cls.id} start={f.period_start} end={f.period_end} />
        </aside>
      </div>
    </div>
  );
}

function usePeriod(studentId, classId, start, end) {
  const [d, setD] = useState(null);
  useEffect(() => {
    let off = false;
    (async () => {
      let aq = supabase.from('attendance').select('status').eq('student_id', studentId).eq('class_id', classId);
      let mq = supabase.from('marks').select('mark, absent, comment, assessment:assessments!inner(id, title, kind, max_mark, held_on, class_id)')
        .eq('student_id', studentId).eq('assessment.class_id', classId);
      let wq = supabase.from('submissions').select('id, status, issues').eq('student_id', studentId);
      if (start) { aq = aq.gte('on_date', start); mq = mq.gte('assessment.held_on', start); wq = wq.gte('created_at', start); }
      if (end) { aq = aq.lte('on_date', end); mq = mq.lte('assessment.held_on', end); wq = wq.lte('created_at', end + 'T23:59:59'); }
      const [a, m, w] = await Promise.all([aq, mq, wq]);
      if (off) return;
      const c = { present: 0, late: 0, absent: 0, excused: 0 };
      (a.data || []).forEach((x) => { c[x.status]++; });
      const n = (a.data || []).length;
      const marks = (m.data || []).filter((x) => x.assessment).sort((x, y) => x.assessment.held_on.localeCompare(y.assessment.held_on));
      setD({ c, n, rate: n ? Math.round(((c.present + c.late) / n) * 100) : null, marks, writing: (w.data || []).length });
    })();
    return () => { off = true; };
  }, [studentId, classId, start, end]);
  return d;
}

function PeriodSummary({ studentId, classId, start, end }) {
  const d = usePeriod(studentId, classId, start, end);
  if (!d) return <section className="card"><p className="muted small">{t('Loading…')}</p></section>;
  return (
    <section className="card">
      <h3>{t('Included automatically')}</h3>
      <p className="small">{t('Attendance')}: <b>{d.rate == null ? t('not recorded') : `${d.rate}%`}</b> ({t('{n} days', { n: d.n })})</p>
      <p className="small">{t('Marks')}: {d.marks.length} · {t('Writing pieces checked with தமிழ் திருத்தி')}: {d.writing}</p>
    </section>
  );
}

// Printable report card. Used by teachers (preview), students and parents.
export function ReportCard({ report, studentName, className, teacher, onBack }) {
  const d = usePeriod(report.student_id, report.class_id, report.period_start, report.period_end);
  const scored = d?.marks.filter((m) => !m.absent && m.mark != null) || [];
  const avg = scored.length ? Math.round(scored.reduce((s, m) => s + pct(m.mark, m.assessment.max_mark), 0) / scored.length) : null;
  const pdfRef = useRef(null);
  return (
    <div className="stack">
      <div className="row between wrap noprint">
        <button className="btn small" onClick={onBack}>← {t('Back')}</button>
        <div className="row wrap">
          <PdfShare targetRef={pdfRef} title={`${studentName || ''} · ${report.term} · ${SITE.school}`}
            filename={`report-${(studentName || 'student').replace(/[^\w\u0B80-\u0BFF -]+/g, '').trim().replace(/\s+/g, '-')}-${report.term.replace(/\s+/g, '-')}.pdf`} />
        </div>
      </div>
      <article ref={pdfRef} data-pdf-root className="card reportcard printable">
        <header className="rc-head">
          <div>
            <p className="rc-school">{SITE.logoUrl && <img src={SITE.logoUrl} alt="" className="rc-logo" />}{SITE.school}{SITE.schoolTa ? ` · ${SITE.schoolTa}` : ''}</p>
            <h2 className="title">தேர்ச்சி அறிக்கை · Student report</h2>
          </div>
          <div className="rc-meta small">
            <div><b>{studentName || t('Student')}</b></div>
            <div>{className} · {report.term}</div>
            {(report.period_start || report.period_end) && <div className="muted">{fmtDay(report.period_start, { day: 'numeric', month: 'short', year: 'numeric' })} – {fmtDay(report.period_end, { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
          </div>
        </header>
        <section>
          <h3>{t('Skills')} · திறன்கள்</h3>
          <table className="table rc-skills"><tbody>
            {SKILLS.map(([k, en, ta]) => (
              <tr key={k}><td>{en} <span className="muted">· {ta}</span></td><td>{report.skills?.[k] ? <Rating v={report.skills[k]} /> : '—'}</td></tr>
            ))}
            {report.effort && <tr><td>Effort <span className="muted">· முயற்சி</span></td><td><Rating v={report.effort} /></td></tr>}
            {report.behaviour && <tr><td>Behaviour <span className="muted">· நடத்தை</span></td><td><Rating v={report.behaviour} /></td></tr>}
          </tbody></table>
        </section>
        <section className="rc-grid">
          <div>
            <h3>{t('Attendance')} · வருகை</h3>
            {!d ? <p className="muted small">{t('Loading…')}</p> : d.n ? (
              <p className="small"><b className="rc-big">{d.rate}%</b><br />{Object.entries(ATTENDANCE).map(([k, v]) => `${tl(v)} ${d.c[k]}`).join(' · ')}</p>
            ) : <p className="muted small">{t('Not recorded for this period.')}</p>}
          </div>
          <div>
            <h3>{t('Marks')} · மதிப்பெண்கள்</h3>
            {!d ? <p className="muted small">{t('Loading…')}</p> : d.marks.length ? (
              <>
                {avg != null && <p className="small"><b className="rc-big">{avg}%</b> {t('average')}</p>}
                <table className="table"><tbody>{d.marks.map((m) => (
                  <tr key={m.assessment.id}><td>{m.assessment.title}<span className="small muted"> · {tl(ASSESSMENT_KINDS[m.assessment.kind])}</span></td>
                    <td className="num">{m.absent ? t('Absent') : m.mark == null ? '–' : `${Number(m.mark)}/${Number(m.assessment.max_mark)}`}</td></tr>
                ))}</tbody></table>
              </>
            ) : <p className="muted small">{t('No published marks in this period.')}</p>}
          </div>
        </section>
        {report.strengths && <section><h3>{t('Strengths')} · பலங்கள்</h3><p className="pre">{report.strengths}</p></section>}
        {report.next_steps && <section><h3>{t('Next steps')} · அடுத்த படிகள்</h3><p className="pre">{report.next_steps}</p></section>}
        {report.comment && <section><h3>{t('Teacher’s comment')} · ஆசிரியர் கருத்து</h3><p className="pre">{report.comment}</p></section>}
        <footer className="rc-foot small muted">
          <span>{teacher ? `${t('Teacher')}: ${teacher}` : ''}</span>
          <span>{report.published_at ? `${t('Issued')} ${fmtDay(report.published_at.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })}` : t('Draft — not yet visible to parents')}</span>
        </footer>
      </article>
    </div>
  );
}

function Rating({ v }) {
  const i = RATINGS.indexOf(v);
  return <span className="rating"><span className="dots" aria-hidden="true">{RATINGS.map((_, j) => <i key={j} className={j >= i && i >= 0 ? 'on' : ''} />).reverse()}</span>{v} {RATING_TA[v] ? <span className="muted">· {RATING_TA[v]}</span> : null}</span>;
}

function MyReports({ ctx }) {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    supabase.from('reports').select('*, class:classes(name, teacher:profiles(full_name))').eq('student_id', ctx.studentId)
      .order('published_at', { ascending: false }).then(({ data }) => setList(data || []));
  }, [ctx.studentId]);
  if (open) return <ReportCard report={open} studentName={ctx.studentName} className={open.class?.name} teacher={open.class?.teacher?.full_name} onBack={() => setOpen(null)} />;
  return (
    <div className="stack">
      <h2 className="title">{t('Reports')} <span className="ta">· அறிக்கைகள்</span>{ctx.role === 'parent' ? ` — ${ctx.studentName}` : ''}</h2>
      <section className="card">
        {!list ? <p className="muted">{t('Loading…')}</p> : !list.length ? <p className="muted">{t('No reports yet. The teacher publishes them at the end of each term.')}</p> : (
          <ul className="plain">{list.map((r) => (
            <li key={r.id} className="row between wrap repitem">
              <span><b>{r.term}</b> · {r.class?.name}<span className="small muted"> · {t('issued')} {fmtDay(r.published_at?.slice(0, 10))}</span></span>
              <button className="btn small primary" onClick={() => setOpen(r)}>{t('Open report')}</button>
            </li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}
