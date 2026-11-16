import React, { useEffect, useState } from 'react';
import { supabase, errText } from '../supabase.js';
import { fmtDay } from '../lib/util.js';
import { t } from '../i18n.js';
import { NeedsSetup } from './Setup.jsx';
import Reader, { canRead } from '../components/Reader.jsx';
import { FILE_TYPES, FILE_ACCEPT, MAX_FILE_BYTES, fileExt, fmtSize } from '../lib/media.js';

const FileTag = ({ doc }) => <span className="file-ext" aria-hidden="true">{fileExt(doc.file_name)}</span>;

// Documents a teacher shares with one or more classes (batches).
export default function Documents({ ctx }) {
  return ctx.role === 'teacher' ? <TeacherDocs ctx={ctx} /> : <ReaderDocs ctx={ctx} />;
}

// Students and parents: everything shared with their classes.
function ReaderDocs({ ctx }) {
  const [rows, setRows] = useState(null);
  const [find, setFind] = useState('');
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(null);
  useEffect(() => {
    if (!ctx.classIds.length) return;
    supabase.from('document_classes').select('class_id, created_at, document:documents(id, title, note, file_path, file_name, size)')
      .in('class_id', ctx.classIds).order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setMsg(errText(error));
        const seen = new Set(); // a document shared with two of my classes shows once
        setRows((data || []).filter((r) => r.document && !seen.has(r.document.id) && seen.add(r.document.id)));
      });
  }, []);
  const title = <h2 className="title">{t('Documents')} <span className="ta">· ஆவணங்கள்</span></h2>;
  if (!ctx.classIds.length) return <div className="stack">{title}<NeedsSetup ctx={ctx} /></div>;
  const names = Object.fromEntries(ctx.scope.classes.map((c) => [c.id, c.name]));
  const shown = (rows || []).filter((r) => !find || `${r.document.title} ${r.document.note} ${r.document.file_name}`.toLowerCase().includes(find.toLowerCase()));
  return (
    <div className="stack">
      <div className="row between wrap">{title}
        {rows?.length > 5 && <input value={find} onChange={(e) => setFind(e.target.value)} placeholder={t('Search')} aria-label={t('Search')} />}
      </div>
      {msg && <p className="card notice small" role="status">{msg}</p>}
      <section className="card">
        {!rows ? <p className="muted">{t('Loading…')}</p> : !shown.length ? <p className="muted">{rows.length ? t('Nothing matches.') : t('Your teacher has not shared any documents yet.')}</p> : (
          <ul className="doclist">
            {shown.map((r) => (
              <li key={r.document.id}>
                <FileTag doc={r.document} />
                <div className="doc-main">
                  <b>{r.document.title}</b>
                  {r.document.note && <p className="small pre">{r.document.note}</p>}
                  <span className="small muted">{fmtDay(r.created_at.slice(0, 10))}{ctx.classIds.length > 1 && names[r.class_id] ? ` · ${names[r.class_id]}` : ''}{r.document.size ? ` · ${fmtSize(r.document.size)}` : ''}</span>
                </div>
                <button className="btn primary small" onClick={() => setOpen(r.document)}>{canRead(r.document.file_name) ? t('Read') : t('Open')}</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {open && <Reader bucket="documents" path={open.file_path} name={open.file_name} title={open.title} onClose={() => setOpen(null)} />}
    </div>
  );
}

// Teachers: upload once, then tick the classes that should have each document.
function TeacherDocs({ ctx }) {
  const admin = ctx.profile.is_admin;
  const [docs, setDocs] = useState(null);
  const [classes, setClasses] = useState(ctx.scope.classes);
  const [files, setFiles] = useState([]);
  const [form, setForm] = useState({ title: '', note: '' });
  const [pick, setPick] = useState(() => (ctx.cls ? [ctx.cls.id] : []));
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(null);

  async function load() {
    const { data, error } = await supabase.from('documents').select('id, title, note, file_path, file_name, size, created_at, shares:document_classes(class_id)')
      .eq('owner_id', ctx.profile.id).order('created_at', { ascending: false });
    if (error) setMsg(/documents/.test(error.message || '') && /find|exist|schema/.test(error.message) ? t('Run the documents database update (20261117000000_documents.sql) first.') : errText(error));
    setDocs(data || []);
  }
  useEffect(() => {
    load();
    // An admin can share with every class in the school, not only their own.
    if (admin) supabase.from('classes').select('id, name').order('name').then(({ data }) => { if (data?.length) setClasses(data); });
  }, []);

  function addFiles(list) {
    setMsg(''); const ok = [];
    for (const f of [...list]) {
      if (!FILE_TYPES[fileExt(f.name)]) { setMsg(t('“{name}” cannot be attached. Use PDF, Word, PowerPoint, Excel, a picture or audio.', { name: f.name })); continue; }
      if (f.size > MAX_FILE_BYTES) { setMsg(t('“{name}” is larger than 25 MB.', { name: f.name })); continue; }
      ok.push(f);
    }
    setFiles((cur) => [...cur, ...ok].slice(0, 10));
  }
  const togglePick = (id) => setPick((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  async function upload(e) {
    e.preventDefault(); setMsg('');
    if (!files.length) { setMsg(t('Choose at least one file.')); return; }
    setBusy(true);
    let done = 0;
    for (const f of files) {
      const ext = fileExt(f.name);
      const id = crypto.randomUUID();
      const path = `${ctx.profile.id}/${crypto.randomUUID()}.${ext}`;
      setMsg(t('Uploading {name}…', { name: f.name }));
      const up = await supabase.storage.from('documents').upload(path, f, { contentType: FILE_TYPES[ext] });
      if (up.error) { setMsg(t('“{name}” could not be uploaded.', { name: f.name }) + ' ' + errText(up.error)); break; }
      // One file: use the typed title. Several files: each is named after its file.
      const title = (files.length === 1 && form.title.trim()) || f.name.replace(/\.[^.]+$/, '');
      const ins = await supabase.from('documents').insert({ id, owner_id: ctx.profile.id, title: title.slice(0, 200), note: form.note.trim(), file_path: path, file_name: f.name.slice(0, 200), size: f.size });
      if (ins.error) { await supabase.storage.from('documents').remove([path]); setMsg(errText(ins.error)); break; }
      if (pick.length) {
        const sh = await supabase.from('document_classes').insert(pick.map((class_id) => ({ document_id: id, class_id, shared_by: ctx.profile.id })));
        if (sh.error) { setMsg(errText(sh.error)); break; }
      }
      done++;
    }
    setBusy(false);
    if (done === files.length) {
      setMsg(pick.length ? t('Shared. Students and parents get a notification.') : t('Saved. Tick a class below when you want to share it.'));
      setFiles([]); setForm({ title: '', note: '' });
    }
    load();
  }
  async function toggleShare(doc, classId) {
    const on = doc.shares.some((s) => s.class_id === classId);
    const { error } = on
      ? await supabase.from('document_classes').delete().eq('document_id', doc.id).eq('class_id', classId)
      : await supabase.from('document_classes').insert({ document_id: doc.id, class_id: classId, shared_by: ctx.profile.id });
    const name = classes.find((c) => c.id === classId)?.name || '';
    setMsg(error ? errText(error) : on ? t('{name} can no longer see “{title}”.', { name, title: doc.title }) : t('“{title}” is now shared with {name}.', { name, title: doc.title }));
    load();
  }
  async function shareAll(doc) {
    const rows = classes.filter((c) => !doc.shares.some((s) => s.class_id === c.id)).map((c) => ({ document_id: doc.id, class_id: c.id, shared_by: ctx.profile.id }));
    if (!rows.length) return;
    const { error } = await supabase.from('document_classes').insert(rows);
    setMsg(error ? errText(error) : t('“{title}” is now shared with every class.', { title: doc.title }));
    load();
  }
  async function remove(doc) {
    if (!confirm(t('Delete “{title}”? Every class loses it.', { title: doc.title }))) return;
    const { error } = await supabase.from('documents').delete().eq('id', doc.id);
    if (error) { setMsg(errText(error)); return; }
    await supabase.storage.from('documents').remove([doc.file_path]);
    setMsg(t('Deleted.')); load();
  }
  async function saveEdit(e) {
    e.preventDefault();
    if (!edit.title.trim()) return;
    const { error } = await supabase.from('documents').update({ title: edit.title.trim(), note: edit.note.trim() }).eq('id', edit.id);
    setMsg(error ? errText(error) : t('Saved.')); setEdit(null); load();
  }

  return (
    <div className="stack">
      <h2 className="title">{t('Documents')} <span className="ta">· ஆவணங்கள்</span></h2>
      {msg && <p className="card notice small" role="status">{msg}</p>}
      <div className="grid2">
        <section className="card">
          <h3>{t('My documents')}</h3>
          {!docs ? <p className="muted">{t('Loading…')}</p> : !docs.length ? <p className="muted">{t('Nothing here yet. Upload a document and choose the classes that should get it.')}</p> : (
            <ul className="doclist">
              {docs.map((d) => (
                <li key={d.id} className="doc-own">
                  <FileTag doc={d} />
                  <div className="doc-main">
                    {edit?.id === d.id ? (
                      <form className="form" onSubmit={saveEdit}>
                        <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} maxLength={200} aria-label={t('Title')} />
                        <textarea rows={2} value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} maxLength={1000} placeholder={t('Note for students (optional)')} />
                        <div className="row"><button className="btn primary small">{t('Save')}</button><button type="button" className="btn small" onClick={() => setEdit(null)}>{t('Cancel')}</button></div>
                      </form>
                    ) : (
                      <>
                        <b>{d.title}</b>
                        {d.note && <p className="small pre">{d.note}</p>}
                        <span className="small muted">{d.file_name} · {fmtSize(d.size)} · {fmtDay(d.created_at.slice(0, 10))}</span>
                      </>
                    )}
                    <div className="doc-share">
                      <span className="small muted">{d.shares.length ? t('Shared with:') : t('Not shared yet. Tick a class:')}</span>
                      {classes.map((c) => (
                        <label key={c.id} className={'chip check' + (d.shares.some((s) => s.class_id === c.id) ? ' on' : '')}>
                          <input type="checkbox" checked={d.shares.some((s) => s.class_id === c.id)} onChange={() => toggleShare(d, c.id)} /> {c.name}
                        </label>
                      ))}
                      {!classes.length && <span className="small muted">{t('Create a class first.')}</span>}
                    </div>
                    <div className="row wrap act-foot">
                      <button className="btn small" onClick={() => setOpen(d)}>{canRead(d.file_name) ? t('Read') : t('Open')}</button>
                      {classes.length > 1 && d.shares.length < classes.length && <button className="btn small" onClick={() => shareAll(d)}>{t('Share with all classes')}</button>}
                      <button className="btn small" onClick={() => setEdit({ id: d.id, title: d.title, note: d.note || '' })}>{t('Rename')}</button>
                      <button className="btn small" onClick={() => remove(d)}>{t('Delete')}</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="card">
          <h3>{t('Share a document')}</h3>
          <form className="form" onSubmit={upload}>
            <div className="field">{t('Files')}
              {files.length > 0 && (
                <ul className="filelist">{files.map((f, i) => (
                  <li key={`${f.name}-${i}`}><span className="file-name">{f.name}</span><span className="small muted">{fmtSize(f.size)}</span>
                    <button type="button" className="btn small" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}>{t('Remove')}</button></li>
                ))}</ul>
              )}
              <label className="btn small addfile">{t('Choose files')}
                <input type="file" multiple accept={FILE_ACCEPT} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
              </label>
              <span className="small muted">{t('PDF, Word, PowerPoint, Excel, pictures or audio. Up to 10 at a time, 25 MB each.')}</span>
              <span className="small muted">{t('PDFs open as a booklet that students read on the page. Word, PowerPoint and Excel files can only be downloaded, so save them as PDF first.')}</span>
            </div>
            {files.length <= 1 && <label className="field">{t('Title (optional)')}<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} placeholder={t('Uses the file name if left empty')} /></label>}
            <label className="field">{t('Note for students (optional)')}<textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={1000} /></label>
            <div className="field">{t('Share with')}
              <div className="doc-share">
                {classes.map((c) => (
                  <label key={c.id} className={'chip check' + (pick.includes(c.id) ? ' on' : '')}><input type="checkbox" checked={pick.includes(c.id)} onChange={() => togglePick(c.id)} /> {c.name}</label>
                ))}
                {!classes.length && <span className="small muted">{t('Create a class first.')}</span>}
              </div>
              <span className="small muted">{t('You can add or remove classes later, without uploading again.')}</span>
            </div>
            <button className="btn primary" disabled={busy}>{busy ? t('Please wait…') : pick.length ? t('Upload and share') : t('Upload')}</button>
          </form>
        </aside>
      </div>
      {open && <Reader bucket="documents" path={open.file_path} name={open.file_name} title={open.title} onClose={() => setOpen(null)} />}
    </div>
  );
}
