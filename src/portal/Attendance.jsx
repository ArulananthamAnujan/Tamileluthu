import React, { useEffect, useMemo, useState } from 'react';
import { supabase, errText } from '../supabase.js';
import { useRoster } from '../lib/scope.js';
import { isoDay, addDays, fmtDay } from '../lib/util.js';
import { downloadCsv } from '../lib/csv.js';
import { ATTENDANCE } from '../site.js';
import { NeedsSetup } from './Setup.jsx';

export default function Attendance({ ctx }) {
  if (!ctx.classIds.length) return <NeedsSetup ctx={ctx} />;
  return ctx.role === 'teacher' ? <RollCall ctx={ctx} /> : <MyAttendance ctx={ctx} />;
}

function RollCall({ ctx }) {
  const { cls } = ctx;
  const roster = useRoster(cls.id);
  const [day, setDay] = useState(isoDay());
  const [rows, setRows] = useState({});
  const [msg, setMsg] = useState('');
  const [from, setFrom] = useState(addDays(isoDay(), -70));
  const [history, setHistory] = useState([]);

  useEffect(() => {
    supabase.from('attendance').select('student_id, status, note').eq('class_id', cls.id).eq('on_date', day)
      .then(({ data }) => setRows(Object.fromEntries((data || []).map((r) => [r.student_id, r]))));
  }, [cls.id, day]);
  async function loadHistory() {
    const { data } = await supabase.from('attendance').select('student_id, on_date, status').eq('class_id', cls.id)
      .gte('on_date', from).order('on_date');
    setHistory(data || []);
  }
  useEffect(() => { loadHistory(); }, [cls.id, from]);

  async function mark(students, status) {
    setMsg('');
    const payload = students.map((s) => ({
      class_id: cls.id, student_id: s.id, on_date: day, status,
      note: rows[s.id]?.note || null, marked_by: ctx.profile.id, marked_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('attendance').upsert(payload, { onConflict: 'class_id,student_id,on_date' });
    if (error) { setMsg(errText(error)); return; }
    setRows((r) => { const n = { ...r }; students.forEach((s) => { n[s.id] = { ...n[s.id], status }; }); return n; });
    loadHistory();
  }
  async function saveNote(s, note) {
    if (!rows[s.id]) return;
    const { error } = await supabase.from('attendance').update({ note: note.trim() || null })
      .eq('class_id', cls.id).eq('student_id', s.id).eq('on_date', day);
    if (error) setMsg(errText(error));
  }
  async function clear(s) {
    await supabase.from('attendance').delete().eq('class_id', cls.id).eq('student_id', s.id).eq('on_date', day);
    setRows((r) => { const n = { ...r }; delete n[s.id]; return n; }); loadHistory();
  }

  const summary = useMemo(() => roster.map((s) => {
    const mine = history.filter((h) => h.student_id === s.id);
    const c = { present: 0, late: 0, absent: 0, excused: 0 };
    mine.forEach((h) => { c[h.status]++; });
    const rate = mine.length ? Math.round(((c.present + c.late) / mine.length) * 100) : null;
    return { s, c, n: mine.length, rate };
  }), [roster, history]);
  const days = [...new Set(history.map((h) => h.on_date))];
  const unmarked = roster.filter((s) => !rows[s.id]);

  function exportCsv() {
    const by = {}; history.forEach((h) => { by[`${h.student_id}|${h.on_date}`] = ATTENDANCE[h.status].short; });
    downloadCsv(`attendance-${cls.name}-${from}.csv`, [
      ['Student', ...days, 'Present %'],
      ...summary.map((r) => [r.s.full_name, ...days.map((d) => by[`${r.s.id}|${d}`] || ''), r.rate ?? '']),
    ]);
  }

  return (
    <div className="stack">
      <div className="row between wrap">
        <h2 className="title">Attendance <span className="ta">· வருகைப் பதிவு</span></h2>
        <div className="row wrap">
          <button className="btn small" onClick={() => setDay(addDays(day, -7))} aria-label="Previous week">← 7 days</button>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value || isoDay())} aria-label="Date" />
          <button className="btn small" onClick={() => setDay(isoDay())}>Today</button>
        </div>
      </div>
      <section className="card">
        <div className="row between wrap">
          <h3>{fmtDay(day, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
          <div className="row wrap">
            <span className="small muted">{roster.length - unmarked.length}/{roster.length} marked</span>
            {unmarked.length > 0 && <button className="btn small primary" onClick={() => mark(unmarked, 'present')}>Mark the rest present</button>}
          </div>
        </div>
        {!roster.length && <p className="muted">No students in this class yet.</p>}
        <ul className="roll">
          {roster.map((s) => {
            const r = rows[s.id];
            return (
              <li key={s.id} className={r ? `st-${r.status}` : ''}>
                <span className="roll-name">{s.full_name}</span>
                <span className="seg" role="group" aria-label={`Attendance for ${s.full_name}`}>
                  {Object.entries(ATTENDANCE).map(([k, v]) => (
                    <button key={k} className={`a-${k}` + (r?.status === k ? ' on' : '')} aria-pressed={r?.status === k}
                      onClick={() => mark([s], k)} title={v.label}>{v.short}<span className="sr"> {v.label}</span></button>
                  ))}
                </span>
                {r && r.status !== 'present' && (
                  <input className="roll-note" defaultValue={r.note || ''} placeholder="Note (e.g. sick)" maxLength={300}
                    onBlur={(e) => saveNote(s, e.target.value)} key={`${day}-${s.id}`} aria-label={`Note for ${s.full_name}`} />
                )}
                {r && <button className="link small" onClick={() => clear(s)}>Clear</button>}
              </li>
            );
          })}
        </ul>
        {msg && <p className="error small">{msg}</p>}
        <p className="muted small">P present · L late · A absent · E excused. Each tap saves straight away; students and parents see their own record.</p>
      </section>
      <section className="card">
        <div className="row between wrap">
          <h3>Summary</h3>
          <div className="row wrap">
            <label className="row small">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value || addDays(isoDay(), -70))} /></label>
            <button className="btn small" onClick={exportCsv} disabled={!history.length}>Download CSV</button>
          </div>
        </div>
        <p className="muted small">{days.length} class day{days.length === 1 ? '' : 's'} recorded since {fmtDay(from)}.</p>
        <div className="tablewrap">
          <table className="table">
            <thead><tr><th>Student</th><th className="num">Present</th><th className="num">Late</th><th className="num">Absent</th><th className="num">Excused</th><th className="num">Attendance</th></tr></thead>
            <tbody>{summary.map((r) => (
              <tr key={r.s.id}>
                <td>{r.s.full_name}</td>
                <td className="num">{r.c.present}</td><td className="num">{r.c.late}</td><td className="num">{r.c.absent}</td><td className="num">{r.c.excused}</td>
                <td className={'num' + (r.rate != null && r.rate < 80 ? ' bad' : '')}>{r.rate == null ? '–' : `${r.rate}%`}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MyAttendance({ ctx }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    supabase.from('attendance').select('class_id, on_date, status, note').eq('student_id', ctx.studentId)
      .order('on_date', { ascending: false }).limit(400).then(({ data }) => setRows(data || []));
  }, [ctx.studentId]);
  if (!rows) return <p className="muted">Loading…</p>;
  const c = { present: 0, late: 0, absent: 0, excused: 0 };
  rows.forEach((r) => { c[r.status]++; });
  const rate = rows.length ? Math.round(((c.present + c.late) / rows.length) * 100) : null;
  const names = Object.fromEntries(ctx.scope.classes.map((x) => [x.id, x.name]));
  return (
    <div className="stack">
      <h2 className="title">Attendance <span className="ta">· வருகை</span>{ctx.role === 'parent' ? ` — ${ctx.studentName}` : ''}</h2>
      <div className="tiles">
        <div className="tile"><span className="tile-n">{rate == null ? '–' : `${rate}%`}</span><span>Attendance</span></div>
        {Object.entries(ATTENDANCE).map(([k, v]) => <div key={k} className={`tile a-${k}`}><span className="tile-n">{c[k]}</span><span>{v.label}</span></div>)}
      </div>
      <section className="card">
        <h3>Every class day</h3>
        {!rows.length ? <p className="muted">No attendance recorded yet.</p> : (
          <ul className="daygrid">
            {rows.map((r) => (
              <li key={r.class_id + r.on_date} className={`a-${r.status}`} title={`${ATTENDANCE[r.status].label}${r.note ? ` – ${r.note}` : ''}`}>
                <b>{ATTENDANCE[r.status].short}</b>
                <span>{fmtDay(r.on_date, { day: 'numeric', month: 'short' })}</span>
                {ctx.classIds.length > 1 && <span className="small muted">{names[r.class_id]}</span>}
                {r.note && <span className="small muted">{r.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
