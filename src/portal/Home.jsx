import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase.js';
import { useRoster } from '../lib/scope.js';
import { isoDay, addDays, fmtDay, pct } from '../lib/util.js';
import { ASSESSMENT_KINDS } from '../site.js';
import ActivityList from './ActivityList.jsx';
import { NeedsSetup, NewClass } from './Setup.jsx';
import Icon from '../components/Icon.jsx';

export default function Home({ ctx }) {
  if (!ctx.classIds.length) return <div className="stack"><Greeting ctx={ctx} /><NeedsSetup ctx={ctx} /></div>;
  return ctx.role === 'teacher' ? <TeacherHome ctx={ctx} /> : <FamilyHome ctx={ctx} />;
}

function Greeting({ ctx }) {
  const h = new Date().getHours();
  const hello = h < 12 ? 'காலை வணக்கம்' : h < 17 ? 'வணக்கம்' : 'மாலை வணக்கம்';
  return (
    <div>
      <h2 className="title">{hello}, {ctx.profile.full_name?.split(' ')[0] || 'friend'}</h2>
      <p className="muted small">{new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
    </div>
  );
}

function useDiary(classIds, from) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    supabase.from('activities').select('*').in('class_id', classIds)
      .or(`on_date.gte.${from},due_on.gte.${isoDay()}`).order('on_date', { ascending: false }).limit(15)
      .then(({ data }) => setItems(data || []));
  }, [classIds.join(), from]);
  return items;
}

function TeacherHome({ ctx }) {
  const { cls } = ctx;
  const roster = useRoster(cls.id);
  const items = useDiary([cls.id], addDays(isoDay(), -3));
  const [marked, setMarked] = useState(null);
  const [drafts, setDrafts] = useState([]);
  useEffect(() => {
    supabase.from('attendance').select('student_id', { count: 'exact', head: true }).eq('class_id', cls.id).eq('on_date', isoDay())
      .then(({ count }) => setMarked(count || 0));
    supabase.from('assessments').select('id, title, held_on').eq('class_id', cls.id).eq('published', false).order('held_on', { ascending: false })
      .then(({ data }) => setDrafts(data || []));
  }, [cls.id]);

  return (
    <div className="stack">
      <Greeting ctx={ctx} />
      <div className="tiles">
        <a className="tile" href="#/attendance"><span className="tile-n">{marked ?? '–'}/{roster.length}</span><span>Marked today</span></a>
        <a className="tile" href="#/diary"><span className="tile-n">{items?.filter((a) => a.on_date === isoDay()).length ?? '–'}</span><span>Diary posts today</span></a>
        <a className="tile" href="#/marks"><span className="tile-n">{drafts.length}</span><span>Unpublished marks</span></a>
        <a className="tile" href="#/writing"><span className="tile-n"><Icon name="writing" size={30} /></span><span>தமிழ் திருத்தி</span></a>
      </div>
      <div className="grid2">
        <section className="card">
          <div className="row between wrap"><h3>Class diary</h3><a className="btn small primary" href="#/diary">+ Post homework or notice</a></div>
          {items ? <ActivityList items={items} empty="Nothing posted in the last few days." /> : <p className="muted">Loading…</p>}
        </section>
        <aside className="stack">
          <section className="card">
            <h3>{cls.name}</h3>
            <p className="small">Class code: <b className="code-inline">{cls.join_code}</b></p>
            <p className="muted small">Students enter this code after signing up. Parents link with their child's parent code.</p>
            <p className="small">{roster.length} student{roster.length === 1 ? '' : 's'}</p>
            {roster.length > 0 && <ul className="plain small cols">{roster.map((s) => <li key={s.id}>{s.full_name}</li>)}</ul>}
          </section>
          {drafts.length > 0 && (
            <section className="card">
              <h3>Marks not yet sent to parents</h3>
              <ul className="plain small">{drafts.slice(0, 5).map((d) => <li key={d.id}><a href={`#/marks?a=${d.id}`}>{d.title}</a> · {fmtDay(d.held_on)}</li>)}</ul>
            </section>
          )}
          <section className="card">
            <h3>New class</h3>
            <NewClass profile={ctx.profile} onDone={ctx.reload} />
          </section>
        </aside>
      </div>
    </div>
  );
}

function FamilyHome({ ctx }) {
  const sid = ctx.studentId;
  const items = useDiary(ctx.classIds, addDays(isoDay(), -7));
  const [done, setDone] = useState({});
  const [att, setAtt] = useState([]);
  const [marks, setMarks] = useState([]);
  const [report, setReport] = useState(null);

  useEffect(() => {
    supabase.from('attendance').select('on_date, status').eq('student_id', sid).gte('on_date', addDays(isoDay(), -365))
      .then(({ data }) => setAtt(data || []));
    supabase.from('marks').select('mark, absent, assessment:assessments(id, title, kind, max_mark, held_on)').eq('student_id', sid)
      .then(({ data }) => setMarks((data || []).filter((m) => m.assessment).sort((a, b) => b.assessment.held_on.localeCompare(a.assessment.held_on))));
    supabase.from('reports').select('id, term, published_at').eq('student_id', sid).order('published_at', { ascending: false }).limit(1)
      .then(({ data }) => setReport(data?.[0] || null));
  }, [sid]);
  useEffect(() => {
    if (!items?.length) return;
    supabase.from('activity_done').select('activity_id').eq('student_id', sid).in('activity_id', items.map((a) => a.id))
      .then(({ data }) => {
        const d = {}; items.forEach((a) => { d[a.id] = false; });
        (data || []).forEach((x) => { d[x.activity_id] = true; });
        setDone(d);
      });
  }, [items, sid]);

  async function toggle(a) {
    if (done[a.id]) await supabase.from('activity_done').delete().eq('activity_id', a.id).eq('student_id', sid);
    else await supabase.from('activity_done').insert({ activity_id: a.id, student_id: sid });
    setDone((d) => ({ ...d, [a.id]: !d[a.id] }));
  }

  const present = att.filter((a) => a.status === 'present' || a.status === 'late').length;
  const rate = att.length ? Math.round((present / att.length) * 100) : null;
  const todo = (items || []).filter((a) => a.kind === 'homework' && !done[a.id] && (!a.due_on || a.due_on >= isoDay())).length;
  const names = Object.fromEntries(ctx.scope.classes.map((c) => [c.id, c.name]));
  const who = ctx.role === 'parent' ? ctx.studentName : 'You';

  return (
    <div className="stack">
      <Greeting ctx={ctx} />
      <div className="tiles">
        <a className="tile" href="#/diary"><span className="tile-n">{items ? todo : '–'}</span><span>Homework to do</span></a>
        <a className="tile" href="#/attendance"><span className="tile-n">{rate == null ? '–' : `${rate}%`}</span><span>Attendance (12 months)</span></a>
        <a className="tile" href="#/marks"><span className="tile-n">{marks[0] && !marks[0].absent && marks[0].mark != null ? `${pct(marks[0].mark, marks[0].assessment.max_mark)}%` : '–'}</span><span>Latest mark</span></a>
        <a className="tile" href="#/reports"><span className="tile-n">{report ? <Icon name="reports" size={30} /> : '–'}</span><span>{report ? report.term : 'No report yet'}</span></a>
      </div>
      <div className="grid2">
        <section className="card">
          <h3>This week</h3>
          {items ? <ActivityList items={items} done={done} onToggle={ctx.role === 'student' ? toggle : undefined}
            classNames={names} showClass={ctx.classIds.length > 1} empty="No homework or notices this week." /> : <p className="muted">Loading…</p>}
        </section>
        <aside className="stack">
          <section className="card">
            <h3>Recent marks</h3>
            {marks.length ? (
              <table className="table"><tbody>
                {marks.slice(0, 5).map((m) => (
                  <tr key={m.assessment.id}>
                    <td>{m.assessment.title}<div className="small muted">{ASSESSMENT_KINDS[m.assessment.kind]} · {fmtDay(m.assessment.held_on)}</div></td>
                    <td className="num">{m.absent ? 'Absent' : m.mark == null ? '–' : <><b>{Number(m.mark)}</b>/{Number(m.assessment.max_mark)}</>}</td>
                  </tr>
                ))}
              </tbody></table>
            ) : <p className="muted small">{who} {ctx.role === 'parent' ? 'has' : 'have'} no published marks yet.</p>}
          </section>
          {ctx.role === 'parent' && <ParentTip />}
        </aside>
      </div>
    </div>
  );
}

function ParentTip() {
  return (
    <section className="card notice">
      <h3>For parents</h3>
      <p className="small">Reports and marks also arrive by email when the teacher sends them. You can print any report or save it as a PDF from the Reports tab.</p>
    </section>
  );
}
