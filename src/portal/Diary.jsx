import React, { useEffect, useState } from 'react';
import { supabase, errText } from '../supabase.js';
import { callFn, useRoster } from '../lib/scope.js';
import { isoDay, addDays, fmtDay } from '../lib/util.js';
import { ACTIVITY_KINDS } from '../site.js';
import ActivityList, { activityText } from './ActivityList.jsx';
import { t, tl } from '../i18n.js';
import WaButton from '../components/Wa.jsx';
import { NeedsSetup } from './Setup.jsx';
import { youtubeId, youtubeWatchUrl, FILE_TYPES, FILE_ACCEPT, MAX_FILE_BYTES, MAX_FILES, fileExt, fmtSize } from '../lib/media.js';

const blank = () => ({ kind: 'homework', title: '', body: '', link_url: '', video_url: '', attachments: [], copy_work: '', reading_work: '', presenter_id: '', presentation_topic: '', on_date: isoDay(), due_on: addDays(isoDay(), 7) });

export default function Diary({ ctx }) {
  const [items, setItems] = useState(null);
  const [done, setDone] = useState({});
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(30);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');
  const [files, setFiles] = useState([]); // new files, not uploaded yet
  const [busy, setBusy] = useState(false);
  const teacher = ctx.role === 'teacher';
  const roster = useRoster(teacher ? ctx.cls?.id : null);
  const [turns, setTurns] = useState({}); // student id → the last date they presented

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
    if (teacher) {
      const { data: past } = await supabase.from('activities').select('presenter_id, on_date').eq('class_id', ctx.cls.id).order('on_date', { ascending: false }).limit(300);
      const m = {}; (past || []).forEach((x) => { if (x.presenter_id && !m[x.presenter_id]) m[x.presenter_id] = x.on_date; });
      setTurns(m);
    }
  }
  useEffect(() => { load(); }, [filter, limit]);

  if (!ctx.classIds.length) return <NeedsSetup ctx={ctx} />;

  function addFiles(list) {
    const picked = [...list]; const ok = [];
    setMsg('');
    for (const f of picked) {
      if (!FILE_TYPES[fileExt(f.name)]) { setMsg(t('“{name}” cannot be attached. Use PDF, Word, PowerPoint, Excel, a picture or audio.', { name: f.name })); continue; }
      if (f.size > MAX_FILE_BYTES) { setMsg(t('“{name}” is larger than 25 MB.', { name: f.name })); continue; }
      ok.push(f);
    }
    const room = MAX_FILES - form.attachments.length - files.length;
    if (ok.length > room) setMsg(t('A post can have up to {n} files.', { n: MAX_FILES }));
    setFiles((cur) => [...cur, ...ok.slice(0, Math.max(0, room))]);
  }
  const removeStored = (paths) => (paths.length ? supabase.storage.from('homework').remove(paths) : Promise.resolve());

  async function save(e) {
    e.preventDefault(); setMsg('');
    const row = {
      kind: form.kind, title: form.title.trim(), body: form.body.trim(),
      link_url: form.link_url.trim() || null, on_date: form.on_date, due_on: form.due_on || null,
    };
    const weekly = form.kind === 'homework';
    Object.assign(row, {
      copy_work: weekly ? form.copy_work.trim() : '', reading_work: weekly ? form.reading_work.trim() : '',
      presenter_id: (weekly && form.presenter_id) || null, presentation_topic: weekly && form.presenter_id ? form.presentation_topic.trim() : '',
    });
    // A weekly post with only the parts filled in still gets a title.
    if (!row.title && (row.copy_work || row.reading_work || row.presenter_id)) row.title = 'This week’s homework · இந்த வார வீட்டுப்பாடம்';
    if (!row.title) { setMsg(t('Please add a title.')); return; }
    if (row.link_url && !/^https?:\/\//i.test(row.link_url)) { setMsg(t('Links must start with https://')); return; }
    const video = form.video_url.trim();
    const vid = youtubeId(video);
    if (video && !vid) { setMsg(t('That is not a YouTube link. Copy the link from YouTube’s Share button.')); return; }
    row.video_url = vid ? youtubeWatchUrl(vid) : null;

    setBusy(true);
    const before = editing ? (items.find((a) => a.id === editing)?.attachments || []) : [];
    const classId = editing ? items.find((a) => a.id === editing)?.class_id || ctx.cls.id : ctx.cls.id;
    const added = [];
    for (const f of files) {
      const ext = fileExt(f.name);
      const path = `${classId}/${crypto.randomUUID()}.${ext}`;
      setMsg(t('Uploading {name}…', { name: f.name }));
      const { error: upErr } = await supabase.storage.from('homework').upload(path, f, { contentType: FILE_TYPES[ext] });
      if (upErr) { await removeStored(added.map((x) => x.path)); setBusy(false); setMsg(t('“{name}” could not be uploaded.', { name: f.name }) + ' ' + errText(upErr)); return; }
      added.push({ path, name: f.name.slice(0, 200), size: f.size });
    }
    row.attachments = [...form.attachments, ...added];
    const { error } = editing
      ? await supabase.from('activities').update(row).eq('id', editing)
      : await supabase.from('activities').insert({ ...row, class_id: ctx.cls.id, created_by: ctx.profile.id });
    setBusy(false);
    if (error) { await removeStored(added.map((x) => x.path)); setMsg(errText(error)); return; }
    // Files taken off the post are deleted from storage.
    const kept = new Set(row.attachments.map((x) => x.path));
    await removeStored(before.filter((x) => !kept.has(x.path)).map((x) => x.path));
    setForm(blank()); setFiles([]); setEditing(null); setMsg(editing ? t('Saved.') : t('Posted. Students and parents can see it now.')); load();
  }
  async function remove(a) {
    if (!confirm(t('Delete “{title}”?', { title: a.title }))) return;
    const { error } = await supabase.from('activities').delete().eq('id', a.id);
    if (!error) await removeStored((a.attachments || []).map((x) => x.path));
    load();
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
  // Students in turn order: those who have never presented first, then the longest ago.
  const next = [...roster].sort((a, b) => (turns[a.id] || '').localeCompare(turns[b.id] || '') || a.full_name.localeCompare(b.full_name));
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
            onEdit={teacher ? (a) => { setEditing(a.id); setFiles([]); setForm({ ...blank(), ...a, link_url: a.link_url || '', video_url: a.video_url || '', attachments: a.attachments || [], presenter_id: a.presenter_id || '', due_on: a.due_on || '' }); window.scrollTo(0, 0); } : undefined}
            onDelete={teacher ? remove : undefined}
            onNotify={teacher ? notify : undefined}
            classNames={names} showClass={ctx.classIds.length > 1} share studentId={ctx.studentId}
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
                {form.kind === 'homework' && (
                  <fieldset className="weekly">
                    <legend>{t('This week’s parts (fill in what applies)')}</legend>
                    <label className="field">{t('Copy writing')}<textarea rows={2} value={form.copy_work} onChange={set('copy_work')} maxLength={3000} placeholder={t('e.g. Copy the passage on page 12 neatly, twice')} /></label>
                    <label className="field">{t('Reading comprehension')}<textarea rows={2} value={form.reading_work} onChange={set('reading_work')} maxLength={3000} placeholder={t('e.g. Read the attached passage and answer questions 1–5')} /></label>
                    <label className="field">{t('Who presents this week?')}
                      <select value={form.presenter_id} onChange={set('presenter_id')}>
                        <option value="">{t('No presentation')}</option>
                        {next.map((st) => <option key={st.id} value={st.id}>{st.full_name} — {turns[st.id] ? t('last presented {day}', { day: fmtDay(turns[st.id]) }) : t('has not presented yet')}</option>)}
                      </select>
                    </label>
                    {!form.presenter_id && next.length > 0 && <p className="small muted">{t('Next in turn:')} <button type="button" className="link" onClick={() => setForm((f) => ({ ...f, presenter_id: next[0].id }))}>{next[0].full_name}</button></p>}
                    {form.presenter_id && <label className="field">{t('Presentation topic (optional)')}<input value={form.presentation_topic} onChange={set('presentation_topic')} maxLength={300} /></label>}
                    {form.presenter_id && <p className="small muted">{t('The student and their parents get a notification.')}</p>}
                  </fieldset>
                )}
                <label className="field">{t('Link (optional)')}<input value={form.link_url} onChange={set('link_url')} placeholder="https://" inputMode="url" /></label>
                <label className="field">{t('YouTube video (optional)')}<input value={form.video_url} onChange={set('video_url')} placeholder="https://youtu.be/…" inputMode="url" /></label>
                {form.video_url.trim() && (youtubeId(form.video_url)
                  ? <p className="small okc">✓ {t('The video will play inside the diary.')}</p>
                  : <p className="small bad">{t('That is not a YouTube link. Copy the link from YouTube’s Share button.')}</p>)}
                <div className="field">{t('Files (optional)')}
                  {(form.attachments.length > 0 || files.length > 0) && (
                    <ul className="filelist">
                      {form.attachments.map((f) => (
                        <li key={f.path}><span className="file-name">{f.name}</span><span className="small muted">{fmtSize(f.size)}</span>
                          <button type="button" className="btn small" onClick={() => setForm((x) => ({ ...x, attachments: x.attachments.filter((y) => y.path !== f.path) }))}>{t('Remove')}</button></li>
                      ))}
                      {files.map((f, i) => (
                        <li key={`${f.name}-${i}`}><span className="file-name">{f.name}</span><span className="small muted">{fmtSize(f.size)} · {t('new')}</span>
                          <button type="button" className="btn small" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}>{t('Remove')}</button></li>
                      ))}
                    </ul>
                  )}
                  <label className="btn small addfile">{t('Add files')}
                    <input type="file" multiple accept={FILE_ACCEPT} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
                  </label>
                  <span className="small muted">{t('PDF, Word, PowerPoint, Excel, pictures or audio. Up to {n} files, 25 MB each.', { n: MAX_FILES })}</span>
                </div>
                <div className="row wrap">
                  <label className="field">{t('Date')}<input type="date" value={form.on_date} onChange={set('on_date')} required /></label>
                  <label className="field">{form.kind === 'event' ? t('Event date') : t('Due')}<input type="date" value={form.due_on || ''} onChange={set('due_on')} /></label>
                </div>
                {msg && <p className="small" role="status">{msg}</p>}
                <div className="row">
                  <button className="btn primary" disabled={busy}>{busy ? t('Please wait…') : editing ? t('Save') : t('Post')}</button>
                  {editing && <button type="button" className="btn" disabled={busy} onClick={() => { setEditing(null); setFiles([]); setForm(blank()); }}>{t('Cancel')}</button>}
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
