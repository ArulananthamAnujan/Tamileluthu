import React, { useState } from 'react';
import { supabase, errText } from '../supabase.js';
import { TEXT_TYPES } from '../categories.js';
import { shrinkPhoto } from '../image.js';

const MAX_PAGES = 10;

export default function NewSubmission({ profile, onDone, onCancel }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState(TEXT_TYPES[0][0]);
  const [mode, setMode] = useState('photo');
  const [pages, setPages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  function addFiles(files) {
    const next = [...pages];
    for (const f of files) {
      if (next.length >= MAX_PAGES) { setErr(`Up to ${MAX_PAGES} pages at a time.`); break; }
      next.push({ file: f, url: URL.createObjectURL(f) });
    }
    setPages(next);
  }
  function removePage(i) {
    URL.revokeObjectURL(pages[i].url);
    setPages(pages.filter((_, j) => j !== i));
  }
  function move(i, d) {
    const j = i + d; if (j < 0 || j >= pages.length) return;
    const next = [...pages]; [next[i], next[j]] = [next[j], next[i]]; setPages(next);
  }

  async function submit() {
    setErr('');
    if (mode === 'photo' && !pages.length) { setErr('Add at least one photo of your writing.'); return; }
    if (text.length > 20000) { setErr('Up to 20,000 characters per submission.'); return; }
    if (mode === 'text' && !text.trim()) { setErr('Type or paste your writing first.'); return; }
    try {
      let paths = [];
      if (mode === 'photo') {
        const folder = `${profile.id}/${crypto.randomUUID()}`;
        for (let i = 0; i < pages.length; i++) {
          setBusy(`Uploading page ${i + 1} of ${pages.length}…`);
          const blob = await shrinkPhoto(pages[i].file);
          const path = `${folder}/page-${String(i + 1).padStart(2, '0')}.jpg`;
          const { error } = await supabase.storage.from('writing').upload(path, blob, { contentType: 'image/jpeg' });
          if (error) throw error;
          paths.push(path);
        }
      }
      setBusy('Sending for checking…');
      const { data, error } = await supabase.from('submissions').insert({
        student_id: profile.id,
        title: title.trim() || 'Untitled writing',
        text_type: type,
        input_mode: mode,
        photo_paths: paths,
        original_text: mode === 'text' ? text.trim() : null,
      }).select().single();
      if (error) throw error;
      const { data: result, error: fErr } = await supabase.functions.invoke('check-writing', { body: { submission_id: data.id } });
      // Keep the saved submission so retrying does not create duplicate uploads.
      if (fErr) { onDone({ ...data, error: 'The check could not start. Please try again.' }); return; }
      pages.forEach((p) => URL.revokeObjectURL(p.url));
      onDone({ ...data, status: result?.status || 'checking', check_started_at: new Date().toISOString() });
    } catch (e) {
      setErr(errText(e)); setBusy('');
    }
  }

  return (
    <div className="stack">
      <div className="row between"><button className="btn small" onClick={onCancel}>← Back</button></div>
      <h2 className="title">New writing</h2>
      <div className="card form">
        <label className="field">Title<input id="title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Letter to my cousin" /></label>
        <label className="field">Text type
          <select id="ttype" value={type} onChange={(e) => setType(e.target.value)}>
            {TEXT_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <div className="tabs">
          <button className={mode === 'photo' ? 'on' : ''} onClick={() => setMode('photo')}>Photo of my book</button>
          <button className={mode === 'text' ? 'on' : ''} onClick={() => setMode('text')}>Type or paste</button>
        </div>

        {mode === 'photo' ? (
          <div className="stack">
            <p className="muted small">Photograph each page in good light, held straight over the page. Add the pages in order.</p>
            <div className="thumbs">
              {pages.map((p, i) => (
                <div key={p.url} className="thumb">
                  <img src={p.url} alt={`Page ${i + 1}`} />
                  <span className="pg">Page {i + 1}</span>
                  <div className="tacts">
                    <button aria-label="Move earlier" onClick={() => move(i, -1)} disabled={i === 0}>‹</button>
                    <button aria-label="Remove page" onClick={() => removePage(i)}>×</button>
                    <button aria-label="Move later" onClick={() => move(i, 1)} disabled={i === pages.length - 1}>›</button>
                  </div>
                </div>
              ))}
              {pages.length < MAX_PAGES && (<>
                <label className="addpage">
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
                  <span>+</span>Take photo
                </label>
                <label className="addpage">
                  <input type="file" accept="image/*" multiple onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
                  <span>+</span>{pages.length ? 'Add more pages' : 'Choose photos'}
                </label>
              </>)}
            </div>
          </div>
        ) : (
          <textarea id="wtext" maxLength={20000} className="write" rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="உங்கள் தமிழ் எழுத்தை இங்கே ஒட்டவும்" />
        )}

        {err && <p className="error">{err}</p>}
        <div className="row">
          <button className="btn primary" disabled={!!busy} onClick={submit}>{busy || 'Check my writing'}</button>
        </div>
      </div>
    </div>
  );
}

