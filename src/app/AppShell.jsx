import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase.js';
import { useHash, go } from '../lib/util.js';
import { t, getLang } from '../i18n.js';
import { SITE } from '../site.js';
import { usePortal, SectionView, isSection, NAV } from '../portal/Portal.jsx';
import AppHome from './AppHome.jsx';
import Personalize from './Personalize.jsx';
import { buzz } from './isApp.js';
import Bell from '../components/Bell.jsx';
import Icon from '../components/Icon.jsx';

// Bottom tabs per role; the middle one is the main job for that person.
const TABS = {
  student: ['today', 'diary', 'writing', 'listening'],
  parent: ['today', 'diary', 'marks', 'reports'],
  teacher: ['today', 'diary', 'attendance', 'marks'],
};
const CENTER = { student: 'writing', teacher: 'attendance', parent: null };
const EXTRA = [['account', 'My account', 'என் கணக்கு'], ['personalize', 'Personalize', 'தனிப்பயன்'], ['contact', 'About & contact', 'தொடர்பு'], ['privacy', 'Privacy', 'தனியுரிமை'], ['terms', 'Terms & refunds', 'விதிமுறைகள்']];
const ICON = { personalize: 'star', contact: 'school', privacy: 'lock', terms: 'reports' };

const label = (k) => {
  const n = [...NAV, ['admin', 'Admin', 'நிர்வாகம்'], ['invite', 'Invite students', 'மாணவர்களை அழை'], ...EXTRA].find(([key]) => key === k);
  if (!n) return k;
  if (k === 'writing') return getLang() === 'ta' ? 'திருத்தி' : t('Writing');
  return getLang() === 'ta' ? n[2] : n[1];
};
const initials = (n) => (n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export default function AppShell({ profile, setProfile, onSettings }) {
  const { scope, ctx, cls, child, setClsId, setChildId, joinMsg, clearJoinMsg } = usePortal(profile);
  const { path, query } = useHash();
  const section = path === 'personalize' ? 'personalize' : isSection(path, profile) ? path : 'today';
  const tabs = TABS[profile.role] || TABS.student;
  const [more, setMore] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [pull, setPull] = useState(0);
  const start = useRef(null);

  useEffect(() => { window.scrollTo(0, 0); setMore(false); }, [section]);
  useEffect(() => {
    if (!more) return;
    const onKey = (e) => { if (e.key === 'Escape') setMore(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [more]);

  // Pull down at the top of the screen to refresh.
  const onTouchStart = (e) => { start.current = window.scrollY <= 0 ? e.touches[0].clientY : null; };
  const onTouchMove = (e) => {
    if (start.current == null) return;
    const dy = e.touches[0].clientY - start.current;
    setPull(dy > 0 ? Math.min(90, dy * 0.5) : 0);
  };
  const onTouchEnd = () => {
    if (pull > 60) { buzz(12); scope.reload(); setRefresh((r) => r + 1); }
    setPull(0); start.current = null;
  };

  const moreItems = [
    ...NAV.map(([k]) => k).filter((k) => !tabs.includes(k)),
    ...(profile.role === 'teacher' ? ['invite'] : []),
    ...(profile.is_admin ? ['admin'] : []),
  ];
  const switcher = section !== 'personalize' && !['invite', 'account', 'admin', 'privacy', 'terms', 'contact', 'shop', 'writing'].includes(section);

  return (
    <div className="ax" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <header className={'ax-top' + (section === 'today' ? ' home' : '')}>
        <div className="ax-bar">
          {section === 'today'
            ? <span className="ax-brand">{SITE.logoUrl ? <img src={SITE.logoUrl} alt="" /> : <span className="logo-mark">அ</span>}<b>{SITE.schoolTa || SITE.school}</b></span>
            : <button className="ax-back" onClick={() => (window.history.length > 1 ? window.history.back() : go('today'))} aria-label={t('Back')}><Icon name="arrow" size={20} /></button>}
          <span className="spacer" />
          <Bell profileId={profile.id} />
          <a className="avatar ax-av" href="#/account" aria-label={t('My account')}>{initials(profile.full_name)}</a>
        </div>
        {section !== 'today' && <h1 className="ax-title">{label(section)}</h1>}
        {switcher && profile.role === 'teacher' && scope.classes.length > 1 && (
          <div className="chips-x">{scope.classes.map((c) => (
            <button key={c.id} className={cls?.id === c.id ? 'on' : ''} onClick={() => { buzz(); setClsId(c.id); }}>{c.name}</button>
          ))}</div>
        )}
        {switcher && profile.role === 'parent' && scope.children.length > 1 && (
          <div className="chips-x">{scope.children.map((k) => (
            <button key={k.id} className={child?.id === k.id ? 'on' : ''} onClick={() => { buzz(); setChildId(k.id); }}>
              <span className="avatar sm">{initials(k.full_name)}</span>{k.full_name.split(' ')[0]}
            </button>
          ))}</div>
        )}
      </header>

      <div className="ptr" style={{ height: pull }} aria-hidden="true">
        <span style={{ transform: `rotate(${pull * 4}deg)`, opacity: pull / 60 }}>↻</span>
      </div>

      {joinMsg && <div className="ax-toast" role="status"><span>{joinMsg}</span><button onClick={clearJoinMsg} aria-label="OK"><Icon name="x" size={16} /></button></div>}
      <main className={'ax-main sec-' + section} key={refresh}>
        {section === 'personalize'
          ? <Personalize profile={profile} />
          : <SectionView section={section} ctx={ctx} query={query} profile={profile} setProfile={setProfile} onSettings={onSettings} home={AppHome} />}
      </main>

      <nav className="tabbar" aria-label={t('Sections')}>
        {[...tabs.slice(0, 2), '__center', ...tabs.slice(2)].map((k) => {
          if (k === '__center') {
            const c = CENTER[profile.role];
            return c
              ? <a key={k} href={`#/${c}`} className={'tab center' + (section === c ? ' on' : '')} onClick={() => buzz()}><span className="fab"><Icon name={c === 'writing' ? 'writing' : 'attendance'} size={24} /></span><small>{label(c)}</small></a>
              : null;
          }
          if (k === CENTER[profile.role]) return null;
          return (
            <a key={k} href={`#/${k}`} className={'tab' + (section === k ? ' on' : '')} aria-current={section === k ? 'page' : undefined} onClick={() => buzz()}>
              <Icon name={k} size={22} /><small>{label(k)}</small>
            </a>
          );
        })}
        <button className={'tab' + (more ? ' on' : '')} onClick={() => { buzz(); setMore(true); }} aria-expanded={more}>
          <span className="dots3" aria-hidden="true"><i /><i /><i /></span><small>{getLang() === 'ta' ? 'மேலும்' : t('More')}</small>
        </button>
      </nav>

      {more && (
        <div className="sheet-wrap" onClick={() => setMore(false)}>
          <div className="sheet" role="dialog" aria-label={t('More')} onClick={(e) => e.stopPropagation()}>
            <span className="grab" aria-hidden="true" />
            <div className="sheet-user">
              <span className="avatar">{initials(profile.full_name)}</span>
              <span><b>{profile.full_name}</b><small>{t({ student: 'Student', parent: 'Parent', teacher: 'Teacher' }[profile.role])}{profile.is_admin ? ` · ${t('Admin')}` : ''}</small></span>
            </div>
            <div className="sheet-grid">
              {moreItems.map((k) => (
                <a key={k} href={`#/${k}`} className="sheet-tile" onClick={() => buzz()}><span><Icon name={k} size={22} /></span><small>{label(k)}</small></a>
              ))}
            </div>
            <ul className="sheet-list">
              {EXTRA.map(([k]) => (
                <li key={k}><a href={`#/${k}`} onClick={() => buzz()}><Icon name={ICON[k] || k} size={18} />{label(k)}<Icon name="arrow" size={16} /></a></li>
              ))}
              <li><button onClick={() => { supabase.auth.signOut(); go(''); }}><Icon name="x" size={18} />{t('Sign out')}</button></li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
