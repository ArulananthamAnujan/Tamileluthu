import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase.js';
import { useRoster } from '../lib/scope.js';
import { isoDay, addDays, fmtDay, pct, go } from '../lib/util.js';
import { siteLink } from '../lib/wa.js';
import { SITE, ACTIVITY_KINDS } from '../site.js';
import { t, tl, getLang } from '../i18n.js';
import { usePrefs } from './prefs.js';
import { buzz } from './isApp.js';
import { activityText } from '../portal/ActivityList.jsx';
import { NeedsSetup } from '../portal/Setup.jsx';
import WordOfDay, { KuralCard, useStreak } from './WordOfDay.jsx';
import Icon, { Kolam } from '../components/Icon.jsx';
import WaButton from '../components/Wa.jsx';

export function hello() {
  const h = new Date().getHours();
  return h < 5 ? 'இனிய இரவு' : h < 12 ? 'காலை வணக்கம்' : h < 17 ? 'மதிய வணக்கம்' : 'மாலை வணக்கம்';
}

export function Ring({ value, label, sub, color }) {
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  const r = 30, c = 2 * Math.PI * r;
  return (
    <div className="ring-x">
      <svg viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r={r} className="ring-bg" />
        <circle cx="36" cy="36" r={r} className="ring-fg" style={{ stroke: color, strokeDasharray: c, strokeDashoffset: c * (1 - v / 100) }} />
      </svg>
      <b>{value == null ? '–' : `${Math.round(value)}%`}</b>
      <span>{label}</span>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function Hero({ ctx, line, chip }) {
  const prefs = usePrefs();
  const name = prefs.nickname || ctx.profile.full_name?.split(' ')[0] || '';
  const date = new Date().toLocaleDateString(getLang() === 'ta' ? 'ta-IN' : 'en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <section className="ax-hero">
      <Kolam className="ax-kolam" />
      <p className="ax-date">{date}</p>
      <h2>{hello()},<br /><span>{name}</span></h2>
      {line && <p className="ax-line">{line}</p>}
      {chip}
    </section>
  );
}

function Action({ icon, label, href, onClick, tone }) {
  const inner = <><span className={'qa-ic' + (tone ? ` ${tone}` : '')}><Icon name={icon} size={22} /></span><span>{label}</span></>;
  return href
    ? <a className="qa" href={href} onClick={() => buzz()}>{inner}</a>
    : <button className="qa" onClick={() => { buzz(); onClick(); }}>{inner}</button>;
}

function useWeek(classIds, studentId) {
  const [d, setD] = useState(null);
  useEffect(() => {
    let off = false;
    (async () => {
      const [acts, att, marks] = await Promise.all([
        supabase.from('activities').select('*').in('class_id', classIds).or(`on_date.gte.${addDays(isoDay(), -14)},due_on.gte.${isoDay()}`).order('due_on', { ascending: true }).limit(40),
        supabase.from('attendance').select('status').eq('student_id', studentId).gte('on_date', addDays(isoDay(), -90)),
        supabase.from('marks').select('mark, absent, assessment:assessments(id, title, max_mark, held_on)').eq('student_id', studentId),
      ]);
      const hw = (acts.data || []).filter((a) => a.kind === 'homework');
      let done = new Set();
      if (hw.length) {
        const { data } = await supabase.from('activity_done').select('activity_id').eq('student_id', studentId).in('activity_id', hw.map((a) => a.id));
        done = new Set((data || []).map((x) => x.activity_id));
      }
      const a = att.data || [];
      const ms = (marks.data || []).filter((m) => m.assessment && !m.absent && m.mark != null)
        .sort((x, y) => y.assessment.held_on.localeCompare(x.assessment.held_on));
      if (!off) setD({
        acts: acts.data || [], hw, done,
        att: a.length ? (a.filter((x) => x.status === 'present' || x.status === 'late').length / a.length) * 100 : null,
        latest: ms[0] ? { title: ms[0].assessment.title, p: pct(ms[0].mark, ms[0].assessment.max_mark) } : null,
        avg: ms.length ? ms.slice(0, 5).reduce((s, m) => s + pct(m.mark, m.assessment.max_mark), 0) / Math.min(ms.length, 5) : null,
      });
    })();
    return () => { off = true; };
  }, [classIds.join(), studentId]);
  return [d, setD];
}

function dueText(day) {
  const diff = Math.round((new Date(day + 'T12:00:00') - new Date(isoDay() + 'T12:00:00')) / 86400000);
  if (diff < 0) return t('Overdue');
  if (diff === 0) return t('Due today');
  if (diff === 1) return t('Due tomorrow');
  return t('Due in {n} days', { n: diff });
}

function NextUp({ d, setD, studentId, canTick, who }) {
  const todo = d.hw.filter((a) => !d.done.has(a.id) && (!a.due_on || a.due_on >= addDays(isoDay(), -3)));
  const next = todo.find((a) => a.due_on) || todo[0];
  const weekHw = d.hw.filter((a) => a.on_date >= addDays(isoDay(), -7));
  async function tick(a) {
    buzz(15);
    await supabase.from('activity_done').insert({ activity_id: a.id, student_id: studentId });
    setD({ ...d, done: new Set([...d.done, a.id]) });
  }
  if (!next) {
    return (
      <section className="ax-card next done">
        <span className="ax-kicker">{t('Next up')}</span>
        <h3>🎉 {who ? t('{name} is all caught up!', { name: who }) : t('All homework done!')}</h3>
        <p className="small muted">{t('Nothing is waiting. Why not practise the word of the day?')}</p>
      </section>
    );
  }
  return (
    <section className="ax-card next">
      <div className="row between">
        <span className="ax-kicker">{t('Next up')} · {tl(ACTIVITY_KINDS.homework)}</span>
        {next.due_on && <span className={'due-pill' + (next.due_on <= isoDay() ? ' hot' : '')}>{dueText(next.due_on)}</span>}
      </div>
      <h3>{next.title}</h3>
      {next.body && <p className="small clamp">{next.body}</p>}
      <div className="row wrap">
        {canTick && <button className="btn primary" onClick={() => tick(next)}><Icon name="check" size={18} stroke={2.4} />{t('Mark as done')}</button>}
        <a className="btn" href="#/diary">{t('See all')}</a>
        {todo.length > 1 && <span className="small muted">{t('+{n} more to do', { n: todo.length - 1 })}</span>}
      </div>
      {weekHw.length > 0 && (
        <div className="hw-bar" aria-label={t('{a} of {b} done this week', { a: weekHw.filter((a) => d.done.has(a.id)).length, b: weekHw.length })}>
          {weekHw.map((a) => <i key={a.id} className={d.done.has(a.id) ? 'on' : ''} />)}
        </div>
      )}
    </section>
  );
}

function StudentHome({ ctx }) {
  const prefs = usePrefs();
  const [d, setD] = useWeek(ctx.classIds, ctx.studentId);
  const { streak } = useStreak(ctx.profile.id);
  const show = (k) => !prefs.hidden.includes(k);
  return (
    <div className="ax-stack">
      <Hero ctx={ctx} line={t('Ready to learn something new today?')}
        chip={<span className="hero-chip">🔥 {streak ? t('{n}-day word streak', { n: streak }) : t('Start your word streak today')}</span>} />
      {show('next') && (d ? <NextUp d={d} setD={setD} studentId={ctx.studentId} canTick /> : <div className="ax-card skel" />)}
      {show('actions') && (
        <section className="qa-grid">
          <Action icon="writing" label={t('Check my writing')} href="#/writing" tone="gold" />
          <Action icon="listening" label={t('Listening')} href="#/listening" />
          <Action icon="marks" label={t('My marks')} href="#/marks" />
          <Action icon="shop" label={t('Papers')} href="#/shop" />
        </section>
      )}
      {show('stats') && d && (
        <section className="ax-card rings">
          <Ring value={d.att} label={t('Attendance')} color="var(--accent)" />
          <Ring value={d.latest?.p} label={t('Latest mark')} sub={d.latest?.title} color="var(--gold)" />
          <Ring value={d.hw.length ? (d.hw.filter((a) => d.done.has(a.id)).length / d.hw.length) * 100 : null} label={t('Homework done')} color="var(--gram)" />
        </section>
      )}
      {show('word') && <WordOfDay userId={ctx.profile.id} />}
      {show('word') && <KuralCard />}
    </div>
  );
}

function ParentHome({ ctx }) {
  const prefs = usePrefs();
  const [d, setD] = useWeek(ctx.classIds, ctx.studentId);
  const show = (k) => !prefs.hidden.includes(k);
  const child = ctx.studentName?.split(' ')[0];
  return (
    <div className="ax-stack">
      <Hero ctx={ctx} line={t('Here is how {name} is doing.', { name: child })} />
      {show('stats') && d && (
        <section className="ax-card rings">
          <Ring value={d.att} label={t('Attendance')} color="var(--accent)" />
          <Ring value={d.avg} label={t('Average mark')} sub={t('last 5')} color="var(--gold)" />
          <Ring value={d.hw.length ? (d.hw.filter((a) => d.done.has(a.id)).length / d.hw.length) * 100 : null} label={t('Homework done')} color="var(--gram)" />
        </section>
      )}
      {show('next') && (d ? <NextUp d={d} setD={setD} studentId={ctx.studentId} who={child} /> : <div className="ax-card skel" />)}
      {show('actions') && (
        <section className="qa-grid">
          <Action icon="reports" label={t('Reports')} href="#/reports" />
          <Action icon="attendance" label={t('Attendance')} href="#/attendance" />
          <Action icon="writing" label={t('Writing')} href="#/writing" />
          {SITE.whatsappUrl ? <Action icon="whatsapp" label={t('School group')} href={SITE.whatsappUrl} tone="wa" />
            : SITE.contactPhone ? <Action icon="phone" label={t('Call school')} href={`tel:${SITE.contactPhone.replace(/\s/g, '')}`} />
            : <Action icon="account" label={t('My account')} href="#/account" />}
        </section>
      )}
      {show('word') && <WordOfDay userId={ctx.profile.id} who={child} />}
      {show('word') && <KuralCard />}
    </div>
  );
}

function TeacherHome({ ctx }) {
  const prefs = usePrefs();
  const { cls } = ctx;
  const roster = useRoster(cls.id);
  const [d, setD] = useState(null);
  useEffect(() => {
    Promise.all([
      supabase.from('attendance').select('student_id').eq('class_id', cls.id).eq('on_date', isoDay()),
      supabase.from('activities').select('*').eq('class_id', cls.id).eq('on_date', isoDay()),
      supabase.from('assessments').select('id').eq('class_id', cls.id).eq('published', false),
    ]).then(([a, p, m]) => setD({ marked: (a.data || []).length, posts: p.data || [], drafts: (m.data || []).length }));
  }, [cls.id]);
  const show = (k) => !prefs.hidden.includes(k);
  const rows = d ? [
    { done: roster.length > 0 && d.marked >= roster.length, icon: 'attendance', title: t('Roll call'), sub: t('{a}/{b} marked', { a: d.marked, b: roster.length }), href: '#/attendance' },
    { done: d.posts.length > 0, icon: 'diary', title: t('Today’s homework'), sub: d.posts.length ? t('{n} posted', { n: d.posts.length }) : t('Not posted yet'), href: '#/diary' },
    { done: d.drafts === 0, icon: 'marks', title: t('Marks to send'), sub: d.drafts ? t('{n} waiting', { n: d.drafts }) : t('All sent'), href: '#/marks' },
  ] : [];
  const doneCount = rows.filter((r) => r.done).length;
  const invite = t('Join {cls} on {site}: create a Student account at {url} and enter the class code {code}.', { cls: cls.name, site: SITE.nameEn, url: `${window.location.origin}/#/join?code=${cls.join_code}`, code: cls.join_code });

  return (
    <div className="ax-stack">
      <Hero ctx={ctx} line={d ? t('{a} of {b} done for today', { a: doneCount, b: rows.length }) : ''}
        chip={<span className="hero-chip">{cls.name} · {roster.length} {t('Students').toLowerCase()}</span>} />
      {show('next') && (
        <section className="ax-card checklist">
          <span className="ax-kicker">{t('Today’s checklist')}</span>
          {!d ? <div className="skel" /> : rows.map((r) => (
            <a key={r.title} href={r.href} className={'check-row' + (r.done ? ' done' : '')} onClick={() => buzz()}>
              <span className="check-ic">{r.done ? <Icon name="check" size={18} stroke={2.6} /> : <Icon name={r.icon} size={18} />}</span>
              <span className="check-t"><b>{r.title}</b><small>{r.sub}</small></span>
              <Icon name="arrow" size={16} />
            </a>
          ))}
        </section>
      )}
      {show('actions') && (
        <section className="qa-grid">
          <Action icon="attendance" label={t('Take roll')} href="#/attendance" tone="gold" />
          <Action icon="diary" label={t('Post homework')} href="#/diary" />
          <Action icon="marks" label={t('Enter marks')} href="#/marks" />
          <Action icon="listening" label={t('Listening')} href="#/listening" />
        </section>
      )}
      <section className="ax-card share-card">
        <div><span className="ax-kicker">{t('Class code')}</span><b className="ax-code">{cls.join_code}</b></div>
        <div className="row wrap">
          <a className="btn small primary" href="#/invite"><Icon name="invite" size={15} />{t('Invite')}</a>
          <WaButton text={invite} />
          {d?.posts.length > 0 && <WaButton text={d.posts.map((a) => activityText(a, cls.name)).join('\n\n')} label={t('Share today')} />}
        </div>
      </section>
      {show('word') && <WordOfDay userId={ctx.profile.id} />}
    </div>
  );
}

export default function AppHome({ ctx }) {
  if (!ctx.classIds.length) return <div className="ax-stack"><Hero ctx={ctx} /><NeedsSetup ctx={ctx} /></div>;
  if (ctx.role === 'teacher') return <TeacherHome ctx={ctx} />;
  if (ctx.role === 'parent') return <ParentHome ctx={ctx} />;
  return <StudentHome ctx={ctx} />;
}
export { go };
