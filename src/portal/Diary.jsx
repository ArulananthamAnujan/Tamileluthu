import React, { useEffect, useState } from 'react';
import { supabase, errText } from '../supabase.js';
import { callFn } from '../lib/scope.js';
import { isoDay, addDays } from '../lib/util.js';
import { ACTIVITY_KINDS } from '../site.js';
import ActivityList, { activityText } from './ActivityList.jsx';
import { t, tl } from '../i18n.js';
import WaButton from '../components/Wa.jsx';
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
    if (!row.title) { setMsg(t('Please add a title.')); return; }
    if (row.link_url && !/^https?:\/\//i.test(row.link_url)) { setMsg(t('Links must start with https://')); return; }
    const { error } = editing
      ? await supabase.from('activities').update(row).eq('id', editing)
      : await supabase.from('activities').insert({ ...row, class_id: ctx.cls.id, created_by: ctx.profile.id });
    if (error) { setMsg(errText(error)); return; }
    setForm(blank()); setEditing(null); setMsg(editing ? t('Saved.') : t('Posted. Students and parents can see it now.')); load();
  }
  async function remove(a) {
    if (!confirm(t('Delete “{title}”?', { title: a.title }))) return;
    await supabase.from('activities').delete().eq('id', a.id); load();
  }
  async function notify(a) {
    setMsg(t('Sending…'));
    try {
      const r = await callFn('notify-parents', { kind: 'activity', id: a.id });
      setMsg(r.note ? t(r.note) : t('Emailed {n} parents.', { n: r.sent })); load();
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
        <h2 className="title">{t('Class diary')} <span className="ta">· நாட்குறிப்பு</span></h2>
        <div className="tabs">
          {[['all', t('All')], ...Object.entries(ACTIVITY_KINDS).map(([k, v]) => [k, tl(v)])].map(([k, l]) => (
            <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className={teacher ? 'grid2' : ''}>
        <section className="card">
          {teacher && items?.some((a) => a.on_date >= addDays(isoDay(), -6)) && (
            <div className="row between wrap share-bar">
              <span className="small muted">{t('Send this week’s posts to your class WhatsApp group')}</span>
              <WaButton label={t('Share this week')} text={items.filter((a) => a.on_date >= addDays(isoDay(), -6)).map((a) => activityText(a, ctx.cls.name)).join('\n\n')} />
            </div>
          )}
          {items ? <ActivityList items={items} done={done}
            onToggle={ctx.role === 'student' ? toggle : undefined}
            onEdit={teacher ? (a) => { setEditing(a.id); setForm({ ...blank(), ...a, link_url: a.link_url || '', due_on: a.due_on || '' }); window.scrollTo(0, 0); } : undefined}
            onDelete={teacher ? remove : undefined}
            onNotify={teacher ? notify : undefined}
            classNames={names} showClass={ctx.classIds.length > 1} share
            empty={teacher ? t('Nothing posted yet. Use the form to post today’s homework.') : t('Your teacher has not posted anything yet.')} /> : <p className="muted">{t('Loading…')}</p>}
          {items?.length === limit && <button className="btn small" onClick={() => setLimit(limit + 30)}>{t('Show older')}</button>}
        </section>
        {teacher && (
          <aside className="stack">
            <section className="card">
              <h3>{editing ? t('Edit entry') : t('Post to the diary')}</h3>
              <form className="form" onSubmit={save}>
                <label className="field">{t('Type')}
                  <select value={form.kind} onChange={set('kind')}>
                    {Object.entries(ACTIVITY_KINDS).map(([k, v]) => <option key={k} value={k}>{v.en} · {v.ta}</option>)}
                  </select>
                </label>
                <label className="field">{t('Title')}<input value={form.title} onChange={set('title')} maxLength={200} placeholder={t('e.g. Read பாடம் 4 and answer questions 1–5')} /></label>
                <label className="field">{t('Details')}<textarea rows={4} value={form.body} onChange={set('body')} maxLength={5000} /></label>
                <label className="field">{t('Link (optional)')}<input value={form.link_url} onChange={set('link_url')} placeholder="https://" inputMode="url" /></label>
                <div className="row wrap">
                  <label className="field">{t('Date')}<input type="date" value={form.on_date} onChange={set('on_date')} required /></label>
                  <label className="field">{form.kind === 'event' ? t('Event date') : t('Due')}<input type="date" value={form.due_on || ''} onChange={set('due_on')} /></label>
                </div>
                {msg && <p className="small" role="status">{msg}</p>}
                <div className="row">
                  <button className="btn primary">{editing ? t('Save') : t('Post')}</button>
                  {editing && <button type="button" className="btn" onClick={() => { setEditing(null); setForm(blank()); }}>{t('Cancel')}</button>}
                </div>
                <p className="muted small">{t('Students and parents get a notification straight away. Use “Share” to post it in your class WhatsApp group, or “Email parents” for important notices.')}</p>
              </form>
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}
