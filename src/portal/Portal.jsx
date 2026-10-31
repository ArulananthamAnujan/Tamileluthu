import React, { useEffect, useMemo, useState } from 'react';
import { useScope } from '../lib/scope.js';
import { useHash } from '../lib/util.js';
import { t, getLang } from '../i18n.js';
import Home from './Home.jsx';
import Diary from './Diary.jsx';
import Attendance from './Attendance.jsx';
import Resources from './Resources.jsx';
import Marks from './Marks.jsx';
import Reports from './Reports.jsx';
import Shop from './Shop.jsx';
import Account from './Account.jsx';
import Admin from './Admin.jsx';
import Info from '../pages/Info.jsx';
import Invite from './Invite.jsx';
import Subscription from './Subscription.jsx';
import { supabase, errText } from '../supabase.js';
import Student from '../pages/Student.jsx';
import Parent from '../pages/Parent.jsx';
import Teacher from '../pages/Teacher.jsx';
import Icon from '../components/Icon.jsx';

export const NAV = [
  ['today', 'Today', 'இன்று'],
  ['diary', 'Diary', 'நாட்குறிப்பு'],
  ['attendance', 'Attendance', 'வருகை'],
  ['listening', 'Listening', 'கேட்டல்'],
  ['marks', 'Marks', 'மதிப்பெண்'],
  ['reports', 'Reports', 'அறிக்கை'],
  ['writing', 'திருத்தி', 'Writing'],
  ['shop', 'Papers', 'வினாத்தாள்'],
];
const OTHER = ['account', 'admin', 'privacy', 'terms', 'contact', 'invite', 'subscription'];
const NO_PICKER = ['writing', 'shop', 'account', 'admin', 'privacy', 'terms', 'contact', 'subscription'];

const remember = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } };
const recall = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

// Shared by the website layout (Portal) and the phone app layout (AppShell).
export function usePortal(profile) {
  const scope = useScope(profile);
  const [clsId, setClsId] = useState(() => recall('tt-class'));
  const [childId, setChildId] = useState(() => recall('tt-child'));
  const cls = profile.role === 'teacher' ? (scope.classes.find((c) => c.id === clsId) || scope.classes[0] || null) : null;
  const child = profile.role === 'parent' ? (scope.children.find((c) => c.id === childId) || scope.children[0] || null) : null;
  useEffect(() => { if (cls) remember('tt-class', cls.id); }, [cls?.id]);
  useEffect(() => { if (child) remember('tt-child', child.id); }, [child?.id]);

  // What the screens should show: one class (teacher) or one student and their classes.
  const ctx = useMemo(() => {
    const base = { profile, role: profile.role, scope, reload: scope.reload };
    if (profile.role === 'teacher') return { ...base, cls, classIds: cls ? [cls.id] : [], studentId: null };
    if (profile.role === 'student') return { ...base, classIds: scope.classes.map((c) => c.id), studentId: profile.id, studentName: profile.full_name };
    const ids = scope.memberships.filter((m) => m.student_id === child?.id).map((m) => m.class_id);
    return { ...base, child, classIds: ids, studentId: child?.id || null, studentName: child?.full_name };
  }, [profile, scope, cls?.id, child?.id]);
  // Opened an invite link (#/join?code=…) before or after signing in: join that class.
  const [joinMsg, setJoinMsg] = useState('');
  useEffect(() => {
    let code = null;
    try { code = localStorage.getItem('tt-join'); } catch { /* private mode */ }
    if (!code) return;
    try { localStorage.removeItem('tt-join'); } catch { /* private mode */ }
    if (profile.role !== 'student') { setJoinMsg(t('Invite links are for student accounts. Parents link with their child’s parent code.')); return; }
    supabase.rpc('join_class', { code }).then(({ data, error }) => {
      setJoinMsg(error ? errText(error) : t('You joined {name}.', { name: data }));
      if (!error) scope.reload();
    });
  }, [profile.id]);
  return { scope, ctx, cls, child, setClsId, setChildId, joinMsg, clearJoinMsg: () => setJoinMsg('') };
}

export const SECTIONS = { today: Home, diary: Diary, attendance: Attendance, listening: Resources, marks: Marks, reports: Reports, shop: Shop };
export function isSection(path, profile) {
  return NAV.some(([k]) => k === path) || OTHER.includes(path) || (path === 'admin' && profile.is_admin);
}

export function SectionView({ section, ctx, query, profile, setProfile, onSettings, home }) {
  if (ctx.scope.loading) return <p className="muted">{t('Loading…')}</p>;
  if (section === 'writing') {
    return profile.role === 'student' ? <Student profile={profile} setProfile={setProfile} />
      : profile.role === 'parent' ? <Parent profile={profile} /> : <Teacher profile={profile} />;
  }
  if (section === 'account') return <Account ctx={ctx} setProfile={setProfile} />;
  if (section === 'invite') return <Invite ctx={ctx} />;
  if (section === 'subscription') return <Subscription ctx={ctx} />;
  if (section === 'admin') return <Admin ctx={ctx} onSettings={onSettings} />;
  if (['privacy', 'terms', 'contact'].includes(section)) return <Info page={section} />;
  const S = section === 'today' && home ? home : SECTIONS[section] || Home;
  return <S ctx={ctx} query={query} key={`${section}-${ctx.classIds.join()}-${ctx.studentId}`} />;
}

export default function Portal({ profile, setProfile, onSettings }) {
  const { scope, ctx, cls, child, setClsId, setChildId, joinMsg, clearJoinMsg } = usePortal(profile);
  const { path, query } = useHash();
  const nav = profile.is_admin ? [...NAV, ['admin', 'Admin', 'நிர்வாகம்']] : NAV;
  const section = isSection(path, profile) ? path : 'today';
  useEffect(() => { window.scrollTo(0, 0); }, [section]);
  const body = <SectionView section={section} ctx={ctx} query={query} profile={profile} setProfile={setProfile} onSettings={onSettings} />;
  const ta = getLang() === 'ta';

  return (
    <>
      <nav className="nav" aria-label={t('Sections')}>
        {nav.map(([k, en, tam]) => (
          <a key={k} href={`#/${k}`} className={section === k ? 'on' : ''} aria-current={section === k ? 'page' : undefined}>
            <Icon name={k} size={20} /><b>{ta && k !== 'writing' ? tam : en}</b><span>{ta && k !== 'writing' ? en : tam}</span>
          </a>
        ))}
      </nav>
      {!NO_PICKER.includes(section) && (
        <div className="picker row wrap">
          {profile.role === 'teacher' && scope.classes.length > 0 && (
            <label className="row small">{t('Class')}
              <select value={cls?.id || ''} onChange={(e) => setClsId(e.target.value)}>
                {scope.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          {profile.role === 'parent' && scope.children.length > 1 && (
            <div className="tabs">{scope.children.map((k) => (
              <button key={k.id} className={child?.id === k.id ? 'on' : ''} onClick={() => setChildId(k.id)}>{k.full_name}</button>
            ))}</div>
          )}
          {profile.role === 'parent' && scope.children.length === 1 && <span className="small muted">{t('Showing')} <b>{child.full_name}</b></span>}
          {profile.role !== 'teacher' && ctx.classIds.length > 0 && (
            <span className="small muted">{scope.classes.filter((c) => ctx.classIds.includes(c.id)).map((c) => c.name).join(' · ')}</span>
          )}
        </div>
      )}
      {joinMsg && <div className="card notice row between wrap" role="status"><span>{joinMsg}</span><button className="btn small" onClick={clearJoinMsg}>OK</button></div>}
      <main id="main">{body}</main>
      <footer className="appfoot small muted noprint">
        {profile.role !== 'teacher' && <a href="#/subscription">{t('Subscription')}</a>}
        <a href="#/contact">{t('About & contact')}</a><a href="#/privacy">{t('Privacy')}</a><a href="#/terms">{t('Terms & refunds')}</a><span className="ver">v{__BUILD__}</span>
      </footer>
    </>
  );
}
