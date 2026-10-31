import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, errText } from '../supabase.js';
import { CATS, GROUPS, catOf, typeLabel, fmtDate } from '../categories.js';

// Apply every located fix to show a corrected version.
function correctedText(text, issues) {
  let t = text;
  [...issues].filter((i) => i.start != null && i.correct).sort((a, b) => b.start - a.start)
    .forEach((i) => { t = t.slice(0, i.start) + i.correct + t.slice(i.end); });
  return t;
}

function Highlighted({ text, issues, active, onPick }) {
  const parts = [];
  let pos = 0;
  issues.forEach((it, idx) => {
    if (it.start == null || it.start < pos) return;
    parts.push(text.slice(pos, it.start));
    parts.push(
      <mark key={idx} tabIndex={0} className={`g-${catOf(it).g}${active === idx ? ' on' : ''}`}
        onClick={() => onPick(idx)} onKeyDown={(e) => e.key === 'Enter' && onPick(idx)}>
        {text.slice(it.start, it.end)}
      </mark>,
    );
    pos = it.end;
  });
  parts.push(text.slice(pos));
  return <div className="doc">{parts}</div>;
}

export default function SubmissionView({ sub: initial, viewer, onBack, onChanged }) {
  const [sub, setSub] = useState(initial);
  const [active, setActive] = useState(null);
  const [showFixed, setShowFixed] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [showPhotos, setShowPhotos] = useState(false);
  const [comment, setComment] = useState(initial.teacher_comment || '');
  const [saving, setSaving] = useState('');
  const [now, setNow] = useState(Date.now());
  const listRef = useRef(null);

  const commentDirty = useRef(false);
  const [accessError, setAccessError] = useState('');

  // Refresh on opening even completed work, so teacher comments are never stale.
  useEffect(() => {
    let active = true;
    async function refresh() {
      setNow(Date.now());
      const { data, error } = await supabase.from('submissions').select('*').eq('id', sub.id).single();
      if (!active) return;
      if (error?.code === 'PGRST116') {
        setAccessError('This writing is no longer available to your account.'); setPhotos([]); return;
      }
      if (data) {
        setAccessError(''); setSub(data); onChanged?.(data);
        if (!commentDirty.current) setComment(data.teacher_comment || '');
      }
    }
    refresh();
    const t = setInterval(refresh, sub.status === 'pending' || sub.status === 'checking' ? 4000 : 15000);
    return () => { active = false; clearInterval(t); };
  }, [sub.id, sub.status]);

  useEffect(() => {
    if (!showPhotos || !sub.photo_paths?.length) return;
    supabase.storage.from('writing').createSignedUrls(sub.photo_paths, 300)
      .then(({ data }) => setPhotos((data || []).map((d) => d.signedUrl).filter(Boolean)));
  }, [showPhotos]);

  const issues = useMemo(() => {
    const arr = (sub.issues || []).map((x) => x);
    return [...arr.filter((i) => i.start != null).sort((a, b) => a.start - b.start), ...arr.filter((i) => i.start == null)];
  }, [sub.issues]);
  const counts = useMemo(() => {
    const c = { spell: 0, sandhi: 0, gram: 0, style: 0 };
    issues.forEach((i) => c[catOf(i).g]++);
    return c;
  }, [issues]);

  function pick(idx) {
    setActive(idx);
    const el = listRef.current?.querySelector(`[data-idx="${idx}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function retry() {
    setSaving('Starting the check again…');
    const { data: result, error } = await supabase.functions.invoke('check-writing', { body: { submission_id: sub.id } });
    if (error) { setSaving(errText(error)); return; }
    const { data: fresh } = await supabase.from('submissions').select('*').eq('id', sub.id).single();
    setSub(fresh || { ...sub, status: result?.status || 'checking', check_started_at: new Date().toISOString(), error: null }); setSaving('');
  }
  async function saveComment() {
    setSaving('Saving…');
    const { error } = await supabase.rpc('set_teacher_comment', { sub: sub.id, comment });
    if (error) { setSaving(errText(error)); return; }
    const next = { ...sub, teacher_comment: comment.trim() || null, teacher_comment_at: new Date().toISOString() };
    commentDirty.current = false; setSub(next); onChanged?.(next); setSaving('Saved.');
  }

  const checking = sub.status === 'pending' || sub.status === 'checking';
  const text = sub.original_text || '';
  const stale = sub.status === 'checking' && now - new Date(sub.check_started_at || sub.created_at).getTime() > 300000;

  if (accessError) return <div className="card"><p>{accessError}</p><button className="btn" onClick={onBack}>Back</button></div>;

  return (
    <div className="stack">
      <div className="row between">
        <button className="btn small" onClick={onBack}>← Back</button>
        <span className="muted small">{typeLabel(sub.text_type)} · {fmtDate(sub.created_at)}</span>
      </div>
      <h2 className="title">{sub.title || 'Untitled writing'}</h2>

      {checking && (
        <div className="card notice">{viewer === 'student' && (sub.status === 'pending' || stale) ? <><p>{stale ? 'The check timed out. You can retry safely.' : sub.error || 'Your writing is saved and ready to check.'}</p><button className="btn" disabled={saving === 'Starting the check again…'} onClick={retry}>Start / retry check</button></> : <p><b>Checking…</b> {sub.input_mode === 'photo' ? 'Reading the handwriting, then marking it. ' : ''}This usually takes under a minute. This page updates by itself.</p>}</div>
      )}
      {sub.status === 'error' && (
        <div className="card notice bad">
          <p><b>The check did not finish.</b> {sub.error}</p>
          {viewer === 'student' && <button className="btn" onClick={retry}>Check again</button>}
        </div>
      )}

      {sub.status === 'checked' && (
        <div className="grid2">
          <section className="card flush">
            <div className="bar">
              <div className="chips">
                {Object.entries(GROUPS).map(([g, v]) => (
                  <span key={g} className="chip"><span className={`dot d-${g}`} />{v.label} <b>{counts[g]}</b></span>
                ))}
              </div>
              <span className="spacer" />
              {issues.some((i) => i.correct && i.start != null) && (
                <button className="btn small" onClick={() => setShowFixed(!showFixed)}>{showFixed ? 'Show mistakes' : 'Show corrected version'}</button>
              )}
            </div>
            {showFixed
              ? <div className="doc fixed">{correctedText(text, issues)}</div>
              : <Highlighted text={text} issues={issues} active={active} onPick={pick} />}
            {sub.input_mode === 'photo' && (
              <div className="foot">
                <button className="btn small" onClick={() => setShowPhotos(!showPhotos)}>{showPhotos ? 'Hide photos' : `Show photos (${sub.photo_paths.length})`}</button>
                <span className="muted small">AI transcription: compare unclear words with your original photos.</span>
              </div>
            )}
            {showPhotos && <div className="photos">{photos.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt={`Page ${i + 1}`} /></a>)}</div>}
          </section>

          <aside className="stack">
            <section className="card">
              <h3>AI feedback</h3>
              <p className="muted small">Practice feedback, not an exam grade. Review suggestions with your teacher; a check may list up to 40 corrections.</p>
              <p>{sub.summary || (issues.length ? 'Work through each mistake below.' : 'No definite errors were identified in this check.')}</p>
              {issues.length > 0 && sub.focus && CATS[sub.focus] && <p><b>Practise next:</b> {CATS[sub.focus].label}</p>}
              {sub.handwriting?.length > 0 && (<><p className="label">Handwriting notes</p><ul>{sub.handwriting.map((n, i) => <li key={i}>{n}</li>)}</ul></>)}
              {sub.unclear?.length > 0 && (<><p className="label">Hard to read</p><ul>{sub.unclear.map((n, i) => <li key={i}>{n}</li>)}</ul></>)}
            </section>

            <section className="card">
              <h3>Teacher’s comment</h3>
              {viewer === 'teacher' ? (
                <>
                  <textarea id="tcomment" className="comment" rows={4} value={comment} onChange={(e) => { commentDirty.current = true; setComment(e.target.value); }} placeholder="Write a comment for the student and parents" />
                  <div className="row"><button className="btn primary small" onClick={saveComment}>Save comment</button><span className="muted small">{saving}</span></div>
                </>
              ) : sub.teacher_comment
                ? <p className="tcomment">{sub.teacher_comment}<span className="muted small"> · {fmtDate(sub.teacher_comment_at)}</span></p>
                : <p className="muted">No comment yet.</p>}
            </section>

            <section className="card" ref={listRef}>
              <h3>Suggested corrections ({issues.length})</h3>
              {!issues.length && <p className="muted">None found.</p>}
              <div className="issues">
                {issues.map((it, idx) => {
                  const c = catOf(it);
                  return (
                    <div key={idx} data-idx={idx} className={`issue g-${c.g}${active === idx ? ' on' : ''}`} onClick={() => setActive(idx)}>
                      <span className="cat">{c.label}</span>
                      <div className="fix"><span className="w">{it.wrong}</span>{it.correct && <><span aria-hidden="true">→</span><span className="r">{it.correct}</span></>}</div>
                      {it.rule && <p className="rule"><b>Rule:</b> {it.rule}</p>}
                      {it.explain && <p className="why">{it.explain}</p>}
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>
      )}
      {saving && viewer === 'student' && <p className="muted small">{saving}</p>}
    </div>
  );
}

