import React, { useEffect, useMemo, useState } from 'react';
import { t } from '../i18n.js';
import { supabase, errText } from '../supabase.js';
import { CATS, tally, fmtDate } from '../categories.js';
import SubmissionList from '../components/SubmissionList.jsx';
import SubmissionView from '../components/SubmissionView.jsx';
import Progress from '../components/Progress.jsx';
import NewSubmission from '../components/NewSubmission.jsx';
import Icon from '../components/Icon.jsx';

const remembered = () => { try { return localStorage.getItem('tt-teacher-tab') || 'class'; } catch { return 'class'; } };

// Teachers see their class's writing, or check any student's writing themselves.
export default function Teacher({ profile }) {
  const [tab, setTab] = useState(remembered);
  const pick = (k) => { setTab(k); try { localStorage.setItem('tt-teacher-tab', k); } catch { /* private mode */ } };
  return (
    <div className="stack">
      <div className="tabs teacher-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'class'} className={tab === 'class' ? 'on' : ''} onClick={() => pick('class')}>{t('Class writing')}</button>
        <button role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => pick('mine')}>{t('Check writing myself')}</button>
      </div>
      {tab === 'mine' ? <MyChecks profile={profile} /> : <ClassWriting profile={profile} />}
    </div>
  );
}

function MyChecks({ profile }) {
  const [subs, setSubs] = useState(null);
  const [roster, setRoster] = useState([]);
  const [view, setView] = useState({ name: 'list' });
  const [q, setQ] = useState('');

  async function load() {
    const { data } = await supabase.from('submissions').select('*').eq('student_id', profile.id).order('created_at', { ascending: false });
    setSubs(data || []);
  }
  useEffect(() => {
    load();
    supabase.from('classes').select('id, class_members(student:profiles(id, full_name))').eq('teacher_id', profile.id).then(({ data }) => {
      const seen = new Map();
      (data || []).forEach((c) => (c.class_members || []).forEach((m) => m.student && seen.set(m.student.id, m.student)));
      setRoster([...seen.values()].sort((a, b) => a.full_name.localeCompare(b.full_name)));
    });
  }, []);
  const upsert = (sub) => setSubs((list) => [sub, ...(list || []).filter((x) => x.id !== sub.id)]);

  if (view.name === 'new') return <NewSubmission profile={profile} roster={roster} onCancel={() => setView({ name: 'list' })} onDone={(sub) => { upsert(sub); setView({ name: 'sub', sub }); }} />;
  if (view.name === 'sub') return <SubmissionView sub={view.sub} viewer="checker" studentName={view.sub.checked_for} onBack={() => { setView({ name: 'list' }); load(); }} onChanged={upsert} />;

  const shown = (subs || []).filter((x) => !q || `${x.checked_for || ''} ${x.title}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="grid2">
      <section className="card">
        <div className="row between wrap">
          <h3>{t('My checks')}</h3>
          <button className="btn primary" onClick={() => setView({ name: 'new' })}>+ {t('Check new writing')}</button>
        </div>
        {(subs || []).length > 4 && <input type="search" className="grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search by student name')} aria-label={t('Search by student name')} style={{ width: '100%', margin: '8px 0' }} />}
        {!subs ? <p className="muted">{t('Loading…')}</p>
          : <SubmissionList subs={shown} onOpen={(sub) => setView({ name: 'sub', sub })} empty={t('Nothing checked yet. Press “Check new writing”, type the student’s name and take a photo of their page.')} />}
      </section>
      <aside className="card notice">
        <h3><Icon name="writing" size={18} /> {t('How it works')}</h3>
        <ol className="small steps">
          <li>{t('Type the student’s name (any student, even if they have no account).')}</li>
          <li>{t('Photograph their pages or paste the text, then check.')}</li>
          <li>{t('Open the result and press “Report” to download a PDF, WhatsApp it or email it to the student or parent.')}</li>
        </ol>
        <p className="small muted">{t('These checks are private to you. Students and parents only see what you send them.')}</p>
      </aside>
    </div>
  );
}

function ClassWriting({ profile }) {
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
    const { data: created, error } = await supabase.from('classes').insert({ name: newName.trim(), teacher_id: profile.id }).select().single();
    if (error) { setMsg(errText(error)); return; }
    setNewName(''); await loadClasses(); setCls(created);
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
  if (open) return <SubmissionView sub={open} viewer="teacher" studentName={members.find((m) => m.student_id === open.student_id)?.student.full_name} onBack={() => setOpen(null)} onChanged={update} />;

  if (student) {
    const own = subs.filter((s) => s.student_id === student.id);
    return (
      <div className="stack">
        <div className="row between"><button className="btn small" onClick={() => setStudent(null)}>← {cls?.name}</button></div>
        <h2 className="title">{student.full_name}</h2>
        <div className="grid2">
          <section className="card"><SubmissionList subs={own} onOpen={setOpen} empty={t('No writing uploaded yet.')} /></section>
          <aside className="stack"><Progress subs={own} title="This student’s common mistakes" /></aside>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row between wrap">
        <h2 className="title">{cls ? cls.name : t('Your classes')}</h2>
        {classes.length > 1 && <div className="tabs">{classes.map((c) => <button key={c.id} className={cls?.id === c.id ? 'on' : ''} onClick={() => setCls(c)}>{c.name}</button>)}</div>}
      </div>
      <div className="grid2">
        <section className="card">
          {cls ? (
            <>
              <div className="row between wrap">
                <h3>{t('Students')} ({members.length})</h3>
                <span className="small">{t('Class code')}: <b className="code-inline">{cls.join_code}</b></span>
              </div>
              {!members.length && <p className="muted">{t('No students yet. Give students the class code; they enter it after signing up.')}</p>}
              {members.length > 0 && (
                <div className="tablewrap">
                  <table className="table">
                    <thead><tr><th>{t('Student')}</th><th>{t('Pieces')}</th><th>{t('Last upload')}</th><th>{t('Mistakes')}</th><th>{t('Most common')}</th><th>{t('To comment')}</th><th></th></tr></thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.student_id}>
                          <td><button className="link" onClick={() => setStudent(r.student)}>{r.student.full_name}</button></td>
                          <td className="num">{r.count}</td>
                          <td>{fmtDate(r.last) || '–'}</td>
                          <td className="num">{r.total}</td>
                          <td>{r.top ? CATS[r.top].label : '–'}</td>
                          <td className="num">{r.uncommented || ''}</td>
                          <td><button className="btn small" onClick={() => removeStudent(r.student_id)}>{t('Remove')}</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : <p className="muted">{t('Create your first class. You will get a code to give your students.')}</p>}
        </section>
        <aside className="stack">
          <Progress subs={subs} title="Class’s most common mistakes" />
          <section className="card">
            <h3>{t('Latest uploads')}</h3>
            <SubmissionList subs={subs.slice(0, 8).map((s) => ({ ...s, title: `${members.find((m) => m.student_id === s.student_id)?.student.full_name || ''} · ${s.title}` }))}
              onOpen={(s) => setOpen(subs.find((x) => x.id === s.id))} empty={t('Nothing uploaded yet.')} />
          </section>
          <section className="card">
            <h3>{t('New class')}</h3>
            <form className="row" onSubmit={createClass}>
              <input id="cname" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('e.g. Year 5 Tamil')} />
              <button className="btn">{t('Create')}</button>
            </form>
            {msg && <p className="error small">{msg}</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}

