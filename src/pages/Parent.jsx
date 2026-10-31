import React, { useEffect, useState } from 'react';
import { supabase, errText } from '../supabase.js';
import SubmissionList from '../components/SubmissionList.jsx';
import SubmissionView from '../components/SubmissionView.jsx';
import Progress from '../components/Progress.jsx';

export default function Parent({ profile }) {
  const [children, setChildren] = useState([]);
  const [subs, setSubs] = useState([]);
  const [child, setChild] = useState(null);
  const [open, setOpen] = useState(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    const { data } = await supabase.from('parent_links')
      .select('student_id, student:profiles!parent_links_student_id_fkey(id, full_name)')
      .eq('parent_id', profile.id);
    const kids = (data || []).map((d) => d.student).filter(Boolean);
    setChildren(kids);
    if (kids.length) {
      const { data: s } = await supabase.from('submissions').select('*')
        .in('student_id', kids.map((k) => k.id)).order('created_at', { ascending: false });
      setSubs(s || []);
      setChild((c) => c && kids.some((k) => k.id === c.id) ? c : kids[0]);
    }
  }
  useEffect(() => { load(); }, []);

  async function link(e) {
    e.preventDefault(); setMsg('');
    const { data, error } = await supabase.rpc('link_child', { code });
    if (error) { setMsg(errText(error)); return; }
    setMsg(`Linked to ${data || 'your child'}.`); setCode(''); load();
  }

  if (open) return <SubmissionView sub={open} viewer="parent" onBack={() => setOpen(null)} />;
  const mine = child ? subs.filter((s) => s.student_id === child.id) : [];

  return (
    <div className="stack">
      <div className="row between wrap">
        <h2 className="title">{child ? `${child.full_name}’s writing` : 'Your child’s writing'}</h2>
        {children.length > 1 && (
          <div className="tabs">{children.map((k) => <button key={k.id} className={child?.id === k.id ? 'on' : ''} onClick={() => setChild(k)}>{k.full_name}</button>)}</div>
        )}
      </div>
      <div className="grid2">
        <section className="card">
          {children.length
            ? <SubmissionList subs={mine} onOpen={setOpen} empty="No writing uploaded yet." />
            : <p className="muted">Ask your child for their parent code (it is on their home page), then enter it here.</p>}
        </section>
        <aside className="stack">
          <Progress subs={mine} title="Mistakes to practise at home" />
          <section className="card">
            <h3>Link a child</h3>
            <form className="row" onSubmit={link}>
              <input id="pcode" className="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Parent code" maxLength={8} />
              <button className="btn">Link</button>
            </form>
            {msg && <p className="small">{msg}</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
