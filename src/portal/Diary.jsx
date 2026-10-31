import React, { useEffect, useState } from 'react';
import { supabase, errText } from '../supabase.js';
import { callFn } from '../lib/scope.js';
import { isoDay, addDays } from '../lib/util.js';
import { ACTIVITY_KINDS } from '../site.js';
import ActivityList from './ActivityList.jsx';
import { NeedsSetup } from './Setup.jsx';

const blank = () => ({ kind: 'homework', title: '', body: '', link_url: '', on_date: isoDay(), due_on: addDays(isoDay(), 7) });

export default function Diary({ ctx }) {
  const [items, setItems] = useState(null);
  const [done, setDone] = useState({});
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(30);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');
  const teacher = ctx.role === 'teacher';

  async function load() {
    if (!ctx.classIds.length) return;
    let q = supabase.from('activities').select('*').in('class_id', ctx.classIds).order('on_date', { ascending: false }).order('created_at', { ascending: false }).limit(limit);
    if (filter !== 'all') q = q.eq('kind', filter);
    const { data } = await q;
    const list = data || [];
    const hw = list.filter((a) => a.kind === 'homework').map((a) => a.id);
    if (hw.length) {
      let dq = supabase.from('activity_done').select('activity_id, student_id').in('activity_id', hw);
      if (!teacher) dq = dq.eq('student_id', ctx.studentId);
      const { data: d } = await dq;
      if (teacher) {
        const counts = {}; (d || []).forEach((x) => { counts[x.activity_id] = (counts[x.activity_id] || 0) + 1; });
        list.forEach((a) => { if (a.kind === 'homework') a.doneCount = counts[a.id] || 0; });
      } else {
        const m = {}; hw.forEach((id) => { m[id] = false; }); (d || []).forEach((x) => { m[x.activity_id] = true; });
        setDone(m);
      }
    }
    setItems(list);
  }
  useEffect(() => { load(); }, [filter, limit]);

  if (!ctx.classIds.length) return <NeedsSetup ctx={ctx} />;

  async function save(e) {
    e.preventDefault(); setMsg('');
    const row = {
      kind: form.kind, title: form.title.trim(), body: form.body.trim(),
      link_url: form.link_url.trim() || null, on_date: form.on_date, due_on: form.due_on || null,
    };
    if (!row.title) { setMsg('Please add a title.'); return; }
    if (row.link_url && !/^https?:\/\//i.test(row.link_url)) { setMsg('Links must start with https://'); return; }
    const { error } = editing
      ? await supabase.from('activities').update(row).eq('id', editing)
      : await supabase.from('activities').insert({ ...row, class_id: ctx.cls.id, created_by: ctx.profile.id });
    if (error) { setMsg(errText(error)); return; }
    setForm(blank()); setEditing(null); setMsg(editing ? 'Saved.' : 'Posted. Students and parents can see it now.'); load();
  }
  async function remove(a) {
    if (!confirm(`Delete “${a.title}”?`)) return;
    await supabase.from('activities').delete().eq('id', a.id); load();
  }
  async function notify(a) {
    setMsg('Sending…');
    try {
      const r = await callFn('notify-parents', { kind: 'activity', id: a.id });
      setMsg(r.note || `Emailed ${r.sent} parent${r.sent === 1 ? '' : 's'}.`); load();
    } catch (e2) { setMsg(e2.message); }
  }
  async function toggle(a) {
    if (done[a.id]) await supabase.from('activity_done').delete().eq('activity_id', a.id).eq('student_id', ctx.studentId);
    else await supabase.from('activity_done').insert({ activity_id: a.id, student_id: ctx.studentId });
    setDone((d) => ({ ...d, [a.id]: !d[a.id] }));
  }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const names = Object.fromEntries(ctx.scope.classes.map((c) => [c.id, c.name]));

  return (
    <div className="stack">
      <div className="row between wrap">
        <h2 className="title">Class diary <span className="ta">· நாட்குறிப்பு</span></h2>
        <div className="tabs">
          {[['all', 'All'], ...Object.entries(ACTIVITY_KINDS).map(([k, v]) => [k, v.label])].map(([k, l]) => (
            <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className={teacher ? 'grid2' : ''}>
        <section className="card">
          {items ? <ActivityList items={items} done={done}
            onToggle={ctx.role === 'student' ? toggle : undefined}
            onEdit={teacher ? (a) => { setEditing(a.id); setForm({ ...blank(), ...a, link_url: a.link_url || '', due_on: a.due_on || '' }); window.scrollTo(0, 0); } : undefined}
            onDelete={teacher ? remove : undefined}
            onNotify={teacher ? notify : undefined}
            classNames={names} showClass={ctx.classIds.length > 1}
            empty={teacher ? 'Nothing posted yet. Use the form to post today’s homework.' : 'Your teacher has not posted anything yet.'} /> : <p className="muted">Loading…</p>}
          {items?.length === limit && <button className="btn small" onClick={() => setLimit(limit + 30)}>Show older</button>}
        </section>
        {teacher && (
          <aside className="stack">
            <section className="card">
              <h3>{editing ? 'Edit entry' : 'Post to the diary'}</h3>
              <form className="form" onSubmit={save}>
                <label className="field">Type
                  <select value={form.kind} onChange={set('kind')}>
                    {Object.entries(ACTIVITY_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label} · {v.ta}</option>)}
                  </select>
                </label>
                <label className="field">Title<input value={form.title} onChange={set('title')} maxLength={200} placeholder="e.g. Read பாடம் 4 and answer questions 1–5" /></label>
                <label className="field">Details<textarea rows={4} value={form.body} onChange={set('body')} maxLength={5000} /></label>
                <label className="field">Link (optional)<input value={form.link_url} onChange={set('link_url')} placeholder="https://" inputMode="url" /></label>
                <div className="row wrap">
                  <label className="field">Date<input type="date" value={form.on_date} onChange={set('on_date')} required /></label>
                  <label className="field">{form.kind === 'event' ? 'Event date' : 'Due'}<input type="date" value={form.due_on || ''} onChange={set('due_on')} /></label>
                </div>
                {msg && <p className="small" role="status">{msg}</p>}
                <div className="row">
                  <button className="btn primary">{editing ? 'Save' : 'Post'}</button>
                  {editing && <button type="button" className="btn" onClick={() => { setEditing(null); setForm(blank()); }}>Cancel</button>}
                </div>
                <p className="muted small">Notices and events can be emailed to every parent in the class with “Email parents”.</p>
              </form>
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}
