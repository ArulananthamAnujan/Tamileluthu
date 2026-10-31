import React, { useEffect, useMemo, useState } from 'react';
import { supabase, errText } from '../supabase.js';
import { useRoster, callFn } from '../lib/scope.js';
import { fmtDay, isoDay, pct, go } from '../lib/util.js';
import { downloadCsv } from '../lib/csv.js';
import { ASSESSMENT_KINDS } from '../site.js';
import { NeedsSetup } from './Setup.jsx';

export default function Marks({ ctx, query }) {
  if (!ctx.classIds.length) return <NeedsSetup ctx={ctx} />;
  return ctx.role === 'teacher' ? <Markbook ctx={ctx} selected={query.get('a')} /> : <MyMarks ctx={ctx} />;
}

const blank = () => ({ title: '', kind: 'test', max_mark: '100', held_on: isoDay() });

function Markbook({ ctx, selected }) {
  const { cls } = ctx;
  const roster = useRoster(cls.id);
  const [list, setList] = useState(null);
  const [all, setAll] = useState([]);
  const [form, setForm] = useState(blank);
  const [msg, setMsg] = useState('');

  async function load() {
    const { data } = await supabase.from('assessments').select('*').eq('class_id', cls.id).order('held_on', { ascending: false });
    setList(data || []);
    if (data?.length) {
      const { data: m } = await supabase.from('marks').select('assessment_id, student_id, mark, absent').in('assessment_id', data.map((a) => a.id));
      setAll(m || []);
    } else setAll([]);
  }
  useEffect(() => { load(); }, [cls.id]);

  async function create(e) {
    e.preventDefault(); setMsg('');
    const max = Number(form.max_mark);
    if (!form.title.trim() || !(max > 0)) { setMsg('Add a title and a maximum mark.'); return; }
    const { data, error } = await supabase.from('assessments').insert({
      class_id: cls.id, title: form.title.trim(), kind: form.kind, max_mark: max, held_on: form.held_on, created_by: ctx.profile.id,
    }).select('id').single();
    if (error) { setMsg(errText(error)); return; }
    setForm(blank()); await load(); go(`marks?a=${data.id}`);
  }

  const current = list?.find((a) => a.id === selected);
  if (current) return <MarkSheet ctx={ctx} a={current} roster={roster} onBack={() => { go('marks'); load(); }} onChanged={load} />;

  function exportBook() {
    const cols = [...(list || [])].reverse();
    const by = {}; all.forEach((m) => { by[`${m.student_id}|${m.assessment_id}`] = m; });
    downloadCsv(`markbook-${cls.name}.csv`, [
      ['Student', ...cols.map((a) => `${a.title} (/${Number(a.max_mark)})`)],
      ...roster.map((s) => [s.full_name, ...cols.map((a) => { const m = by[`${s.id}|${a.id}`]; return !m ? '' : m.absent ? 'Absent' : m.mark ?? ''; })]),
    ]);
  }

  return (
    <div className="stack">
      <div className="row between wrap">
        <h2 className="title">Marks <span className="ta">· மதிப்பெண்கள்</span></h2>
        <button className="btn small" onClick={exportBook} disabled={!list?.length}>Download markbook (CSV)</button>
      </div>
      <div className="grid2">
        <section className="card">
          <h3>Tests and exams</h3>
          {!list ? <p className="muted">Loading…</p> : !list.length ? <p className="muted">No assessments yet. Create one to start entering marks.</p> : (
            <div className="tablewrap">
              <table className="table">
                <thead><tr><th>Assessment</th><th>Date</th><th className="num">Entered</th><th className="num">Average</th><th>Status</th></tr></thead>
                <tbody>{list.map((a) => {
                  const ms = all.filter((m) => m.assessment_id === a.id);
                  const vals = ms.filter((m) => !m.absent && m.mark != null).map((m) => Number(m.mark));
                  const avg = vals.length ? pct(vals.reduce((x, y) => x + y, 0) / vals.length, a.max_mark) : null;
                  return (
                    <tr key={a.id}>
                      <td><a href={`#/marks?a=${a.id}`}>{a.title}</a><div className="small muted">{ASSESSMENT_KINDS[a.kind]} · out of {Number(a.max_mark)}</div></td>
                      <td>{fmtDay(a.held_on)}</td>
                      <td className="num">{ms.length}/{roster.length}</td>
                      <td className="num">{avg == null ? '–' : `${avg}%`}</td>
                      <td>{a.published ? <span className="status s-checked">{a.notified_at ? 'Sent' : 'Published'}</span> : <span className="status">Draft</span>}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        </section>
        <aside className="card">
          <h3>New assessment</h3>
          <form className="form" onSubmit={create}>
            <label className="field">Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} placeholder="e.g. Term 4 listening test" /></label>
            <div className="row wrap">
              <label className="field">Type
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  {Object.entries(ASSESSMENT_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <label className="field">Out of<input type="number" min="1" max="1000" step="0.5" value={form.max_mark} onChange={(e) => setForm({ ...form, max_mark: e.target.value })} style={{ width: '6em' }} /></label>
              <label className="field">Date<input type="date" value={form.held_on} onChange={(e) => setForm({ ...form, held_on: e.target.value })} /></label>
            </div>
            {msg && <p className="error small">{msg}</p>}
            <button className="btn primary">Create and enter marks</button>
          </form>
        </aside>
      </div>
    </div>
  );
}

function MarkSheet({ ctx, a, roster, onBack, onChanged }) {
  const [rows, setRows] = useState({});
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('marks').select('*').eq('assessment_id', a.id).then(({ data }) => {
      setRows(Object.fromEntries((data || []).map((m) => [m.student_id, { mark: m.mark == null ? '' : String(Number(m.mark)), absent: m.absent, comment: m.comment || '' }])));
    });
  }, [a.id]);
  const max = Number(a.max_mark);
  const edit = (sid, k, v) => { setDirty(true); setRows((r) => ({ ...r, [sid]: { mark: '', absent: false, comment: '', ...r[sid], [k]: v } })); };

  async function save() {
    setMsg(''); setBusy(true);
    const payload = [];
    for (const s of roster) {
      const r = rows[s.id];
      if (!r || (r.mark === '' && !r.absent && !r.comment)) continue;
      const n = r.mark === '' ? null : Number(r.mark);
      if (n != null && (Number.isNaN(n) || n < 0 || n > max)) { setMsg(`${s.full_name}: mark must be between 0 and ${max}.`); setBusy(false); return false; }
      payload.push({ assessment_id: a.id, student_id: s.id, mark: r.absent ? null : n, absent: Boolean(r.absent), comment: r.comment.trim() || null });
    }
    const { error } = payload.length ? await supabase.from('marks').upsert(payload, { onConflict: 'assessment_id,student_id' }) : { error: null };
    setBusy(false);
    if (error) { setMsg(errText(error)); return false; }
    setDirty(false); setMsg('Saved.'); onChanged();
    return true;
  }
  async function setPublished(v) {
    if (dirty && !(await save())) return;
    const { error } = await supabase.from('assessments').update({ published: v }).eq('id', a.id);
    if (error) setMsg(errText(error)); else { setMsg(v ? 'Published: students and parents can see their own mark.' : 'Hidden from students and parents.'); onChanged(); }
  }
  async function send() {
    if (dirty && !(await save())) return;
    if (!confirm('Publish these marks and email each parent their child’s result?')) return;
    setBusy(true); setMsg('Sending…');
    try {
      const r = await callFn('notify-parents', { kind: 'assessment', id: a.id });
      setMsg(r.note || `Published and emailed ${r.sent} parent${r.sent === 1 ? '' : 's'}.`); onChanged();
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  }
  async function remove() {
    if (!confirm(`Delete “${a.title}” and all its marks?`)) return;
    await supabase.from('assessments').delete().eq('id', a.id); onBack();
  }

  const stats = useMemo(() => {
    const v = roster.map((s) => rows[s.id]).filter((r) => r && !r.absent && r.mark !== '').map((r) => Number(r.mark)).filter((n) => !Number.isNaN(n));
    if (!v.length) return null;
    return { n: v.length, avg: v.reduce((x, y) => x + y, 0) / v.length, hi: Math.max(...v), lo: Math.min(...v) };
  }, [rows, roster]);

  return (
    <div className="stack">
      <div className="row between wrap">
        <button className="btn small" onClick={onBack}>← All marks</button>
        <div className="row wrap">
          {a.published ? <button className="btn small" onClick={() => setPublished(false)}>Unpublish</button>
            : <button className="btn small" onClick={() => setPublished(true)}>Publish (no email)</button>}
          <button className="btn small primary" onClick={send} disabled={busy}>Send to parents</button>
          <button className="btn small" onClick={remove}>Delete</button>
        </div>
      </div>
      <div>
        <h2 className="title">{a.title}</h2>
        <p className="muted small">{ASSESSMENT_KINDS[a.kind]} · {fmtDay(a.held_on)} · out of {max} · {a.published ? `Published${a.notified_at ? ', emailed to parents' : ''}` : 'Draft — only you can see it'}</p>
      </div>
      {stats && (
        <div className="tiles">
          <div className="tile"><span className="tile-n">{pct(stats.avg, max)}%</span><span>Average</span></div>
          <div className="tile"><span className="tile-n">{stats.hi}</span><span>Highest</span></div>
          <div className="tile"><span className="tile-n">{stats.lo}</span><span>Lowest</span></div>
          <div className="tile"><span className="tile-n">{stats.n}/{roster.length}</span><span>Entered</span></div>
        </div>
      )}
      <section className="card">
        <div className="tablewrap">
          <table className="table marks">
            <thead><tr><th>Student</th><th>Mark /{max}</th><th className="num">%</th><th>Absent</th><th>Comment (parents see this)</th></tr></thead>
            <tbody>{roster.map((s, i) => {
              const r = rows[s.id] || { mark: '', absent: false, comment: '' };
              const p = r.absent || r.mark === '' ? null : pct(r.mark, max);
              return (
                <tr key={s.id}>
                  <td>{s.full_name}</td>
                  <td><input className="markin" inputMode="decimal" value={r.absent ? '' : r.mark} disabled={r.absent}
                    onChange={(e) => edit(s.id, 'mark', e.target.value.replace(/[^\d.]/g, ''))}
                    onKeyDown={(e) => { if (e.key === 'Enter') document.querySelectorAll('.markin')[i + 1]?.focus(); }}
                    aria-label={`Mark for ${s.full_name}`} /></td>
                  <td className={'num' + (p != null && p > 100 ? ' bad' : '')}>{p == null ? '' : `${p}%`}</td>
                  <td><input type="checkbox" checked={Boolean(r.absent)} onChange={(e) => edit(s.id, 'absent', e.target.checked)} aria-label={`${s.full_name} absent`} /></td>
                  <td><input className="wide" value={r.comment} maxLength={1000} onChange={(e) => edit(s.id, 'comment', e.target.value)} aria-label={`Comment for ${s.full_name}`} /></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <div className="row wrap" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={save} disabled={busy || !dirty}>{dirty ? 'Save marks' : 'Saved'}</button>
          {msg && <span className="small" role="status">{msg}</span>}
        </div>
      </section>
    </div>
  );
}

function MyMarks({ ctx }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    supabase.from('marks').select('mark, absent, comment, assessment:assessments(id, title, kind, max_mark, held_on, class_id)')
      .eq('student_id', ctx.studentId).then(({ data }) => {
        setRows((data || []).filter((m) => m.assessment).sort((x, y) => y.assessment.held_on.localeCompare(x.assessment.held_on)));
      });
  }, [ctx.studentId]);
  if (!rows) return <p className="muted">Loading…</p>;
  const scored = rows.filter((r) => !r.absent && r.mark != null);
  const avg = scored.length ? Math.round(scored.reduce((s, r) => s + pct(r.mark, r.assessment.max_mark), 0) / scored.length) : null;
  const byKind = {};
  scored.forEach((r) => { (byKind[r.assessment.kind] ||= []).push(pct(r.mark, r.assessment.max_mark)); });
  return (
    <div className="stack">
      <h2 className="title">Marks <span className="ta">· மதிப்பெண்கள்</span>{ctx.role === 'parent' ? ` — ${ctx.studentName}` : ''}</h2>
      {!rows.length ? <div className="card"><p className="muted">No marks published yet. They appear here when the teacher sends them.</p></div> : (
        <>
          <div className="tiles">
            <div className="tile"><span className="tile-n">{avg == null ? '–' : `${avg}%`}</span><span>Overall average</span></div>
            {Object.entries(byKind).map(([k, v]) => (
              <div key={k} className="tile"><span className="tile-n">{Math.round(v.reduce((x, y) => x + y, 0) / v.length)}%</span><span>{ASSESSMENT_KINDS[k]}</span></div>
            ))}
          </div>
          <section className="card">
            <div className="tablewrap">
              <table className="table">
                <thead><tr><th>Assessment</th><th>Date</th><th className="num">Mark</th><th className="num">%</th><th>Teacher’s comment</th></tr></thead>
                <tbody>{rows.map((r) => {
                  const p = r.absent ? null : pct(r.mark, r.assessment.max_mark);
                  return (
                    <tr key={r.assessment.id}>
                      <td>{r.assessment.title}<div className="small muted">{ASSESSMENT_KINDS[r.assessment.kind]}</div></td>
                      <td>{fmtDay(r.assessment.held_on)}</td>
                      <td className="num">{r.absent ? 'Absent' : r.mark == null ? '–' : `${Number(r.mark)}/${Number(r.assessment.max_mark)}`}</td>
                      <td className="num">{p == null ? '' : <span className="pbar"><span style={{ width: `${p}%` }} />{p}%</span>}</td>
                      <td className="small">{r.comment || ''}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
