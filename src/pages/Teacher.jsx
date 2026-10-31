import React, { useEffect, useMemo, useState } from 'react';
import { supabase, errText } from '../supabase.js';
import { CATS, tally, fmtDate } from '../categories.js';
import SubmissionList from '../components/SubmissionList.jsx';
import SubmissionView from '../components/SubmissionView.jsx';
import Progress from '../components/Progress.jsx';

export default function Teacher({ profile }) {
  const [classes, setClasses] = useState([]);
  const [cls, setCls] = useState(null);
  const [members, setMembers] = useState([]);
  const [subs, setSubs] = useState([]);
  const [student, setStudent] = useState(null);
  const [open, setOpen] = useState(null);
  const [newName, setNewName] = useState('');
  const [msg, setMsg] = useState('');

  async function loadClasses() {
    const { data } = await supabase.from('classes').select('*').eq('teacher_id', profile.id).order('created_at');
    setClasses(data || []);
    setCls((c) => (c && (data || []).find((x) => x.id === c.id)) || (data || [])[0] || null);
  }
  useEffect(() => { loadClasses(); }, []);

  async function loadClass(c) {
    if (!c) { setMembers([]); setSubs([]); return; }
    const { data: m } = await supabase.from('class_members')
      .select('student_id, joined_at, student:profiles(id, full_name)').eq('class_id', c.id);
    const list = (m || []).filter((x) => x.student).sort((a, b) => a.student.full_name.localeCompare(b.student.full_name));
    setMembers(list);
    if (list.length) {
      const { data: s } = await supabase.from('submissions').select('*')
        .in('student_id', list.map((x) => x.student_id)).order('created_at', { ascending: false });
      setSubs(s || []);
    } else setSubs([]);
  }
  useEffect(() => { loadClass(cls); setStudent(null); }, [cls?.id]);

  async function createClass(e) {
    e.preventDefault(); setMsg('');
    if (!newName.trim()) return;
    const { error } = await supabase.from('classes').insert({ name: newName.trim(), teacher_id: profile.id });
    if (error) { setMsg(errText(error)); return; }
    setNewName(''); loadClasses();
  }
  async function removeStudent(sid) {
    await supabase.from('class_members').delete().eq('class_id', cls.id).eq('student_id', sid);
    loadClass(cls);
  }

  const rows = useMemo(() => members.map((m) => {
    const own = subs.filter((s) => s.student_id === m.student_id);
    const t = tally(own.filter((s) => s.status === 'checked'));
    return { ...m, count: own.length, last: own[0]?.created_at, total: t.total, top: t.top[0]?.[0], uncommented: own.filter((s) => s.status === 'checked' && !s.teacher_comment).length };
  }), [members, subs]);

  const update = (s) => setSubs((list) => list.map((x) => (x.id === s.id ? s : x)));
  if (open) return <SubmissionView sub={open} viewer="teacher" onBack={() => setOpen(null)} onChanged={update} />;

  if (student) {
    const own = subs.filter((s) => s.student_id === student.id);
    return (
      <div className="stack">
        <div className="row between"><button className="btn small" onClick={() => setStudent(null)}>← {cls?.name}</button></div>
        <h2 className="title">{student.full_name}</h2>
        <div className="grid2">
          <section className="card"><SubmissionList subs={own} onOpen={setOpen} empty="No writing uploaded yet." /></section>
          <aside className="stack"><Progress subs={own} title="This student’s common mistakes" /></aside>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row between wrap">
        <h2 className="title">{cls ? cls.name : 'Your classes'}</h2>
        {classes.length > 1 && <div className="tabs">{classes.map((c) => <button key={c.id} className={cls?.id === c.id ? 'on' : ''} onClick={() => setCls(c)}>{c.name}</button>)}</div>}
      </div>
      <div className="grid2">
        <section className="card">
          {cls ? (
            <>
              <div className="row between wrap">
                <h3>Students ({members.length})</h3>
                <span className="small">Class code: <b className="code-inline">{cls.join_code}</b></span>
              </div>
              {!members.length && <p className="muted">No students yet. Give students the class code; they enter it on their home page.</p>}
              {members.length > 0 && (
                <div className="tablewrap">
                  <table className="table">
                    <thead><tr><th>Student</th><th>Pieces</th><th>Last upload</th><th>Mistakes</th><th>Most common</th><th>To comment</th><th></th></tr></thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.student_id}>
                          <td><button className="link" onClick={() => setStudent(r.student)}>{r.student.full_name}</button></td>
                          <td className="num">{r.count}</td>
                          <td>{fmtDate(r.last) || '–'}</td>
                          <td className="num">{r.total}</td>
                          <td>{r.top ? CATS[r.top].label : '–'}</td>
                          <td className="num">{r.uncommented || ''}</td>
                          <td><button className="btn small" onClick={() => removeStudent(r.student_id)}>Remove</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : <p className="muted">Create your first class. You will get a code to give your students.</p>}
        </section>
        <aside className="stack">
          <Progress subs={subs} title="Class’s most common mistakes" />
          <section className="card">
            <h3>Latest uploads</h3>
            <SubmissionList subs={subs.slice(0, 8).map((s) => ({ ...s, title: `${members.find((m) => m.student_id === s.student_id)?.student.full_name || ''} · ${s.title}` }))}
              onOpen={(s) => setOpen(subs.find((x) => x.id === s.id))} empty="Nothing uploaded yet." />
          </section>
          <section className="card">
            <h3>New class</h3>
            <form className="row" onSubmit={createClass}>
              <input id="cname" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. VCE Tamil 2027" />
              <button className="btn">Create</button>
            </form>
            {msg && <p className="error small">{msg}</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
