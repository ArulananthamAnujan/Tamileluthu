import React, { useEffect, useMemo, useState } from 'react';
import { supabase, errText } from '../supabase.js';
import { useRoster } from '../lib/scope.js';
import { isoDay, addDays, fmtDay, go } from '../lib/util.js';
import { downloadCsv } from '../lib/csv.js';
import { percent, stars } from '../lib/practice.js';
import { t } from '../i18n.js';
import { NeedsSetup } from './Setup.jsx';
import Game, { pick, marksOf, Stars } from './Game.jsx';

// Best and latest result per release (and per student for the teacher's table).
function summarise(attempts) {
  const by = {};
  attempts.forEach((a) => {
    const k = `${a.release_id}|${a.student_id}`;
    const s = (by[k] ||= { release_id: a.release_id, student_id: a.student_id, tries: 0, best: null, last: null });
    s.tries++;
    if (!s.best || a.score > s.best.score) s.best = a;
    if (!s.last || a.created_at > s.last.created_at) s.last = a;
  });
  return Object.values(by);
}
const stageGroups = (sets) => {
  const m = new Map();
  sets.forEach((s) => { if (!m.has(s.stage)) m.set(s.stage, []); m.get(s.stage).push(s); });
  return [...m.entries()].sort((a, b) => a[0] - b[0]);
};
const SET_COLS = 'id, slug, stage, sort, topic, topic_ta, title, title_ta, intro, intro_ta, source, items';

// Practice games. Admins hold the library and give games to teachers; a teacher
// releases a game to a class; students play it and see their score.
export default function Practice({ ctx, query }) {
  const teacher = ctx.role === 'teacher';
  const admin = teacher && ctx.profile.is_admin;
  const [tab, setTab] = useState(() => (teacher && (query?.get('tab') === 'library' || !ctx.cls) ? 'library' : 'class'));
  const [releases, setReleases] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [library, setLibrary] = useState(null);
  const [shares, setShares] = useState([]);
  const [msg, setMsg] = useState('');

  async function load() {
    let rel = [];
    if (ctx.classIds.length) {
      const { data, error } = await supabase.from('practice_releases')
        .select(`id, set_id, class_id, due_on, created_at, set:practice_sets(${SET_COLS})`)
        .in('class_id', ctx.classIds).order('created_at', { ascending: false });
      if (error) setMsg(errText(error));
      rel = (data || []).filter((r) => r.set);
      if (rel.length) {
        let q = supabase.from('practice_attempts').select('release_id, student_id, score, total, created_at').in('release_id', rel.map((r) => r.id));
        if (!teacher) q = q.eq('student_id', ctx.studentId);
        const { data: at } = await q.order('created_at');
        setAttempts(at || []);
      } else setAttempts([]);
    }
    setReleases(rel);
    if (teacher) {
      const [{ data: sets, error }, { data: sh }] = await Promise.all([
        supabase.from('practice_sets').select(SET_COLS).order('stage').order('sort'),
        supabase.from('practice_shares').select('set_id, teacher_id'),
      ]);
      if (error) setMsg(errText(error));
      setShares(sh || []);
      // A teacher's library is what the admin gave them; an admin's is everything.
      const mine = new Set((sh || []).filter((x) => x.teacher_id === ctx.profile.id).map((x) => x.set_id));
      setLibrary((sets || []).filter((s) => admin || mine.has(s.id)));
    }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { if (teacher && query?.get('tab')) setTab(query.get('tab') === 'library' ? 'library' : 'class'); }, [query?.get('tab')]);

  const stats = useMemo(() => summarise(attempts), [attempts]);
  const playId = query?.get('play');
  const previewId = query?.get('preview');

  if (releases === null) return <p className="muted">{t('Loading…')}</p>;

  // A game is open.
  if (playId && ctx.role === 'student') {
    const r = releases.find((x) => x.id === playId);
    if (r) {
      const mine = stats.find((s) => s.release_id === r.id);
      return (
        <Game key={r.id} set={r.set} best={mine?.best} onClose={() => go('practice')}
          onFinish={async (answers) => {
            const { data, error } = await supabase.rpc('practice_finish', { rid: r.id, ans: answers });
            if (error) throw new Error(errText(error));
            setAttempts((cur) => [...cur, { release_id: r.id, student_id: ctx.studentId, score: data.score, total: data.total, created_at: new Date().toISOString() }]);
            return data;
          }} />
      );
    }
  }
  if (previewId && teacher) {
    const s = (library || []).find((x) => x.id === previewId) || releases.find((x) => x.set_id === previewId)?.set;
    if (s) return <Game key={s.id} set={s} preview onClose={() => window.history.length > 1 ? window.history.back() : go('practice')} />;
  }

  const title = <h2 className="title">{t('Practice games')} <span className="ta">· பயிற்சி விளையாட்டுகள்</span></h2>;

  if (!teacher) {
    if (!ctx.classIds.length) return <div className="stack">{title}<NeedsSetup ctx={ctx} /></div>;
    return (
      <div className="stack">
        {title}
        {msg && <p className="card notice small" role="status">{msg}</p>}
        <PlayerList ctx={ctx} releases={releases} stats={stats} />
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row between wrap">
        {title}
        <div className="tabs">
          <button className={tab === 'class' ? 'on' : ''} onClick={() => setTab('class')}>{ctx.cls ? ctx.cls.name : t('My class')}</button>
          <button className={tab === 'library' ? 'on' : ''} onClick={() => setTab('library')}>{t('Game library')}{library ? ` (${library.length})` : ''}</button>
        </div>
      </div>
      {msg && <p className="card notice small" role="status">{msg}</p>}
      {tab === 'class'
        ? (ctx.cls ? <ClassGames ctx={ctx} releases={releases} stats={stats} reload={load} setMsg={setMsg} onLibrary={() => setTab('library')} /> : <NeedsSetup ctx={ctx} />)
        : <Library ctx={ctx} admin={admin} library={library || []} shares={shares} releases={releases} reload={load} setMsg={setMsg} />}
    </div>
  );
}

// Students play; parents see the same list with their child's scores.
function PlayerList({ ctx, releases, stats }) {
  const student = ctx.role === 'student';
  const today = isoDay();
  const rows = releases.map((r) => ({ r, s: stats.find((x) => x.release_id === r.id) }))
    .sort((a, b) => (Boolean(a.s) - Boolean(b.s)) || (a.r.due_on || '9999').localeCompare(b.r.due_on || '9999') || a.r.set.sort - b.r.set.sort);
  const played = rows.filter((x) => x.s);
  const got = played.reduce((n, x) => n + stars(x.s.best.score, x.s.best.total), 0);
  if (!rows.length) {
    return <section className="card"><p className="muted">{student ? t('Your teacher has not released any practice games yet.') : t('No practice games have been released to this class yet.')}</p></section>;
  }
  return (
    <>
      <div className="tiles">
        <div className="tile"><span className="tile-n">{rows.length}</span>{t('Games')}</div>
        <div className="tile"><span className="tile-n">{played.length}</span>{t('Played')}</div>
        <div className="tile"><span className="tile-n">{got}<small className="muted"> / {rows.length * 3}</small></span>{t('Stars')}</div>
      </div>
      <div className="cards">
        {rows.map(({ r, s }) => {
          const late = r.due_on && r.due_on < today && !s;
          return (
            <article key={r.id} className={'card gamecard' + (s ? '' : ' fresh')}>
              <div className="act-head">
                <span className="tag">{t('Stage {n}', { n: r.set.stage })}</span>
                {!s && <span className="tag k-event">{t('New')}</span>}
                {r.due_on && <span className={'small ' + (late ? 'bad' : 'muted')}>{t('Due')} {fmtDay(r.due_on)}</span>}
              </div>
              <h3>{pick(r.set, 'title')}</h3>
              <p className="small muted">{pick(r.set, 'topic')} · {t('{n} questions', { n: r.set.items.length })}</p>
              <div className="product-foot row between wrap">
                {s
                  ? <span className="gamescore"><b>{s.best.score}/{s.best.total}</b> <Stars n={stars(s.best.score, s.best.total)} /><small className="muted"> {t('{n} tries', { n: s.tries })}</small></span>
                  : <span className="small muted">{t('Not played yet')}</span>}
                {student && <button className={'btn small' + (s ? '' : ' primary')} onClick={() => go(`practice?play=${r.id}`)}>{s ? t('Play again') : t('Play')}</button>}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

// Teacher: games released to the selected class, with every student's score.
function ClassGames({ ctx, releases, stats, reload, setMsg, onLibrary }) {
  const roster = useRoster(ctx.cls.id);
  const [open, setOpen] = useState(null);
  const list = releases.filter((r) => r.class_id === ctx.cls.id);

  async function remove(r) {
    if (!confirm(t('Take “{title}” away from {name}? The students’ scores for it are deleted too.', { title: pick(r.set, 'title'), name: ctx.cls.name }))) return;
    const { error } = await supabase.from('practice_releases').delete().eq('id', r.id);
    setMsg(error ? errText(error) : t('Removed from {name}.', { name: ctx.cls.name })); reload();
  }
  async function setDue(r, due) {
    const { error } = await supabase.from('practice_releases').update({ due_on: due || null }).eq('id', r.id);
    if (error) setMsg(errText(error)); reload();
  }
  function csv(r, rows) {
    downloadCsv(`${r.set.slug}-${ctx.cls.name}.csv`.replace(/\s+/g, '-'), [
      [t('Student'), t('Best'), t('Out of'), '%', t('Tries'), t('Last played')],
      ...rows.map(({ st, s }) => [st.full_name, s?.best.score ?? '', s?.best.total ?? marksOf(r.set), s ? percent(s.best.score, s.best.total) : '', s?.tries || 0, s ? s.last.created_at.slice(0, 10) : '']),
    ]);
  }

  if (!list.length) {
    return (
      <section className="card">
        <p className="muted">{t('No games are released to {name} yet.', { name: ctx.cls.name })}</p>
        <button className="btn primary" onClick={onLibrary}>{t('Open the game library')}</button>
      </section>
    );
  }
  return (
    <section className="card">
      <ul className="acts">
        {list.map((r) => {
          const rs = stats.filter((s) => s.release_id === r.id);
          const rows = roster.map((st) => ({ st, s: rs.find((x) => x.student_id === st.id) }));
          const avg = rs.length ? Math.round(rs.reduce((n, s) => n + percent(s.best.score, s.best.total), 0) / rs.length) : null;
          return (
            <li key={r.id} className="act">
              <div className="act-head">
                <span className="tag">{t('Stage {n}', { n: r.set.stage })}</span>
                <span className="small muted">{t('Released')} {fmtDay(r.created_at.slice(0, 10))}</span>
              </div>
              <p className="act-title">{pick(r.set, 'title')}</p>
              <p className="small muted">{pick(r.set, 'topic')} · {r.set.source}</p>
              <div className="row wrap act-foot">
                <span className="small"><b>{rs.length}</b> / {roster.length} {t('played')}{avg != null ? ` · ${t('average best')} ${avg}%` : ''}</span>
                <label className="row small">{t('Due')}<input type="date" value={r.due_on || ''} onChange={(e) => setDue(r, e.target.value)} /></label>
                <button className="btn small" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>{open === r.id ? t('Hide scores') : t('Scores')}</button>
                <button className="btn small" onClick={() => go(`practice?preview=${r.set_id}`)}>{t('Preview')}</button>
                <button className="btn small" onClick={() => remove(r)}>{t('Remove')}</button>
              </div>
              {open === r.id && (
                <div className="tablewrap">
                  <table className="table">
                    <thead><tr><th>{t('Student')}</th><th>{t('Best')}</th><th></th><th>{t('Last')}</th><th>{t('Tries')}</th></tr></thead>
                    <tbody>
                      {rows.map(({ st, s }) => (
                        <tr key={st.id}>
                          <td>{st.full_name}</td>
                          <td className="num">{s ? `${s.best.score}/${s.best.total}` : <span className="muted">{t('Not played yet')}</span>}</td>
                          <td>{s && <Stars n={stars(s.best.score, s.best.total)} />}</td>
                          <td className="num">{s ? `${s.last.score}/${s.last.total} · ${fmtDay(s.last.created_at.slice(0, 10))}` : ''}</td>
                          <td className="num">{s?.tries || ''}</td>
                        </tr>
                      ))}
                      {!rows.length && <tr><td colSpan={5} className="muted">{t('No students in this class yet.')}</td></tr>}
                    </tbody>
                  </table>
                  {rows.length > 0 && <button className="btn small" onClick={() => csv(r, rows)}>{t('Download CSV')}</button>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Teacher: the games given to me, to preview and release. Admin: every game, and who has it.
function Library({ ctx, admin, library, shares, releases, reload, setMsg }) {
  const [staff, setStaff] = useState([]);
  const [rel, setRel] = useState(null); // { id, due } for the game being released
  const [who, setWho] = useState(null); // game whose teacher list is open
  const [bulk, setBulk] = useState('all');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!admin) return;
    supabase.rpc('admin_staff').then(({ data }) => setStaff((data || []).filter((s) => s.user_id).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))));
  }, [admin]);

  const released = new Set(releases.filter((r) => r.class_id === ctx.cls?.id).map((r) => r.set_id));
  const has = (setId, tid) => shares.some((s) => s.set_id === setId && s.teacher_id === tid);
  const others = staff.filter((s) => !s.is_admin); // admins already see every game

  async function release(s) {
    setBusy(true);
    const { error } = await supabase.from('practice_releases').insert({ set_id: s.id, class_id: ctx.cls.id, due_on: rel.due || null, released_by: ctx.profile.id });
    setBusy(false); setRel(null);
    setMsg(error ? errText(error) : t('“{title}” is now open for {name}. Students and parents get a notification.', { title: pick(s, 'title'), name: ctx.cls.name }));
    reload();
  }
  async function toggle(s, tid) {
    const { error } = has(s.id, tid)
      ? await supabase.from('practice_shares').delete().eq('set_id', s.id).eq('teacher_id', tid)
      : await supabase.from('practice_shares').insert({ set_id: s.id, teacher_id: tid, shared_by: ctx.profile.id });
    if (error) setMsg(errText(error));
    reload();
  }
  async function giveAll(give) {
    const targets = bulk === 'all' ? others.map((s) => s.user_id) : [bulk];
    if (!targets.length) { setMsg(t('There are no other teachers yet. Add them under Admin → Teachers.')); return; }
    if (!give && !confirm(t('Take every game back? Classes that already have a game keep it.'))) return;
    setBusy(true);
    let error = null;
    if (give) {
      const rows = targets.flatMap((tid) => library.filter((s) => !has(s.id, tid)).map((s) => ({ set_id: s.id, teacher_id: tid, shared_by: ctx.profile.id })));
      if (rows.length) ({ error } = await supabase.from('practice_shares').insert(rows));
    } else ({ error } = await supabase.from('practice_shares').delete().in('teacher_id', targets));
    setBusy(false);
    setMsg(error ? errText(error) : give ? t('Done. Those teachers can now preview the games and release them to their classes.') : t('Done. The games are hidden from those teachers again.'));
    reload();
  }

  if (!library.length) {
    return <section className="card"><p className="muted">{admin ? t('No games are loaded yet. Run the practice games migration in Supabase.') : t('You have no games yet. The school admin chooses which games each teacher gets.')}</p></section>;
  }
  return (
    <>
      {admin && (
        <section className="card notice">
          <h3>{t('These games are hidden')}</h3>
          <p>{t('Only school admins can see them. Give a game to a teacher and it appears in that teacher’s library; students see it only after the teacher releases it to a class.')}</p>
          <div className="row wrap">
            <label className="row small">{t('Teacher')}
              <select value={bulk} onChange={(e) => setBulk(e.target.value)}>
                <option value="all">{t('All teachers')} ({others.length})</option>
                {others.map((s) => <option key={s.user_id} value={s.user_id}>{s.full_name || s.email}</option>)}
              </select>
            </label>
            <button className="btn primary small" disabled={busy} onClick={() => giveAll(true)}>{t('Give all games')}</button>
            <button className="btn small" disabled={busy} onClick={() => giveAll(false)}>{t('Take all back')}</button>
          </div>
          <p className="small muted">{t('Or use “Teachers” on a game to choose one by one. Play each game in Preview before you give it out.')}</p>
        </section>
      )}
      {!ctx.cls && <p className="card notice small">{t('Create a class first, then you can release games to it.')}</p>}
      {stageGroups(library).map(([stage, sets]) => (
        <section key={stage} className="card">
          <h3>{t('Stage {n}', { n: stage })}</h3>
          <ul className="acts">
            {sets.map((s) => {
              const given = shares.filter((x) => x.set_id === s.id && others.some((o) => o.user_id === x.teacher_id)).length;
              return (
                <li key={s.id} className="act">
                  <p className="act-title">{pick(s, 'title')}</p>
                  <p className="small muted">{pick(s, 'topic')} · {s.source} · {t('{n} questions', { n: s.items.length })}</p>
                  <div className="row wrap act-foot">
                    <button className="btn small" onClick={() => go(`practice?preview=${s.id}`)}>{t('Preview')}</button>
                    {ctx.cls && (released.has(s.id)
                      ? <span className="small okc">✓ {t('Released to {name}', { name: ctx.cls.name })}</span>
                      : <button className="btn small primary" onClick={() => setRel(rel?.id === s.id ? null : { id: s.id, due: addDays(isoDay(), 7) })}>{t('Release to {name}', { name: ctx.cls.name })}</button>)}
                    {admin && <button className="btn small" onClick={() => setWho(who === s.id ? null : s.id)} aria-expanded={who === s.id}>{t('Teachers')} ({given})</button>}
                  </div>
                  {rel?.id === s.id && (
                    <div className="row wrap relbox">
                      <label className="row small">{t('Due (optional)')}<input type="date" value={rel.due} onChange={(e) => setRel({ ...rel, due: e.target.value })} /></label>
                      <button className="btn small primary" disabled={busy} onClick={() => release(s)}>{t('Release now')}</button>
                      <button className="btn small" onClick={() => setRel(null)}>{t('Cancel')}</button>
                    </div>
                  )}
                  {admin && who === s.id && (
                    <div className="relbox">
                      {others.length ? others.map((o) => (
                        <label key={o.user_id} className="row small check">
                          <input type="checkbox" checked={has(s.id, o.user_id)} onChange={() => toggle(s, o.user_id)} /> {o.full_name || o.email} <span className="muted">{o.email}</span>
                        </label>
                      )) : <p className="small muted">{t('There are no other teachers yet. Add them under Admin → Teachers.')}</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
