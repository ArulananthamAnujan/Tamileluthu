import React, { useEffect, useState } from 'react';
import { supabase, errText } from '../supabase.js';
import SubmissionList from '../components/SubmissionList.jsx';
import SubmissionView from '../components/SubmissionView.jsx';
import NewSubmission from '../components/NewSubmission.jsx';
import Progress from '../components/Progress.jsx';

export default function Student({ profile, setProfile }) {
  const [subs, setSubs] = useState([]);
  const [classes, setClasses] = useState([]);
  const [parents, setParents] = useState([]);
  const [view, setView] = useState({ name: 'home' });
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    const [s, c, p] = await Promise.all([
      supabase.from('submissions').select('*').eq('student_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('class_members').select('class_id, classes(name, teacher:profiles(full_name))').eq('student_id', profile.id),
      supabase.from('parent_links').select('parent_id, parent:profiles!parent_links_parent_id_fkey(full_name)').eq('student_id', profile.id),
    ]);
    setSubs(s.data || []); setClasses(c.data || []); setParents(p.data || []);
  }
  useEffect(() => { load(); }, []);

  async function join(e) {
    e.preventDefault(); setMsg('');
    const { data, error } = await supabase.rpc('join_class', { code });
    if (error) { setMsg(errText(error)); return; }
    setMsg(`You joined ${data}.`); setCode(''); load();
  }
  async function newCode() {
    const { data, error } = await supabase.rpc('new_parent_code');
    if (!error) setProfile({ ...profile, parent_code: data });
  }
  async function unlink(pid) {
    await supabase.from('parent_links').delete().eq('parent_id', pid).eq('student_id', profile.id);
    load();
  }
  const upsert = (s) => setSubs((list) => [s, ...list.filter((x) => x.id !== s.id)]);

  if (view.name === 'new') return <NewSubmission profile={profile} onCancel={() => setView({ name: 'home' })} onDone={(s) => { upsert(s); setView({ name: 'sub', sub: s }); }} />;
  if (view.name === 'sub') return <SubmissionView sub={view.sub} viewer="student" onBack={() => { setView({ name: 'home' }); load(); }} onChanged={upsert} />;

  return (
    <div className="stack">
      <div className="row between wrap">
        <h2 className="title">My writing</h2>
        <button className="btn primary" onClick={() => setView({ name: 'new' })}>+ New writing</button>
      </div>
      <div className="grid2">
        <section className="card">
          <SubmissionList subs={subs} onOpen={(s) => setView({ name: 'sub', sub: s })}
            empty="No writing yet. Press New writing, then take a photo of a page in your book." />
        </section>
        <aside className="stack">
          <Progress subs={subs} title="My most common mistakes" />
          <section className="card">
            <h3>My class</h3>
            {classes.length
              ? <ul className="plain">{classes.map((c) => <li key={c.class_id}><b>{c.classes?.name}</b>{c.classes?.teacher?.full_name ? ` · ${c.classes.teacher.full_name}` : ''}</li>)}</ul>
              : <p className="muted small">Join your class so your teacher can see your writing.</p>}
            <form className="row" onSubmit={join}>
              <input id="classcode" className="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Class code" maxLength={6} />
              <button className="btn">Join</button>
            </form>
            {msg && <p className="small">{msg}</p>}
          </section>
          <section className="card">
            <h3>Parent code</h3>
            <p className="muted small">Give this code to your parent. They enter it in their account to see your writing and feedback.</p>
            <p className="bigcode">{profile.parent_code}</p>
            <button className="btn small" onClick={newCode}>Make a new code</button>
            {parents.length > 0 && (<>
              <p className="label">Linked parents</p>
              <ul className="plain">{parents.map((p) => <li key={p.parent_id} className="row between">{p.parent?.full_name || 'Parent'}<button className="btn small" onClick={() => unlink(p.parent_id)}>Remove</button></li>)}</ul>
            </>)}
          </section>
        </aside>
      </div>
    </div>
  );
}
