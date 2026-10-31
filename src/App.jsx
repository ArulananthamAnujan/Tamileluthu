import React, { useEffect, useState } from 'react';
import { supabase, configured, builtIn, forgetServer } from './supabase.js';
import { SITE } from './site.js';
import { useHash, go } from './lib/util.js';
import { loadSettings } from './lib/settings.js';
import { useLang, setLang, t } from './i18n.js';
import Connect from './components/Connect.jsx';
import Auth from './pages/Auth.jsx';
import Landing, { SiteHeader, SiteFooter, Logo } from './pages/Landing.jsx';
import Info from './pages/Info.jsx';
import Portal from './portal/Portal.jsx';
import Shop from './portal/Shop.jsx';
import InstallButton from './components/InstallButton.jsx';
import LangToggle from './components/LangToggle.jsx';
import Bell from './components/Bell.jsx';
import { isApp } from './app/isApp.js';
import AppShell from './app/AppShell.jsx';
import Welcome from './app/Welcome.jsx';
import './app/prefs.js';

const ROLE_LABEL = { student: 'Student', parent: 'Parent', teacher: 'Teacher' };
const initials = (n) => (n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const PUBLIC = ['signin', 'signup', 'shop', 'privacy', 'terms', 'contact'];

export default function App() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [profileErr, setProfileErr] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [pw, setPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [, setSettingsVersion] = useState(0);
  const route = useHash();
  useLang(); // re-render everything when the language changes

  const refreshSettings = () => loadSettings().then(() => {
    setSettingsVersion((v) => v + 1);
    document.title = `${SITE.school} · ${SITE.nameEn}`;
  });
  useEffect(() => { if (configured) refreshSettings(); }, []);

  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setProfile(null); setProfileErr('');
    if (!session) return;
    supabase.from('profiles').select('*').eq('id', session.user.id).single()
      .then(({ data, error }) => {
        if (cancelled) return;
        setProfile(data); setProfileErr(error ? 'Unable to load your account. Please sign out and try again.' : '');
        let chosen = null; try { chosen = localStorage.getItem('tt-lang'); } catch { /* private mode */ }
        if (data?.lang && !chosen) setLang(data.lang);
      });
    return () => { cancelled = true; };
  }, [session?.user.id]);

  // After signing in from the sign-in page, continue where the visitor was going.
  useEffect(() => {
    if (session && (route.path === 'signin' || route.path === 'signup' || route.path === '')) go(route.query.get('next') || 'today');
  }, [session, route.path]);

  if (!configured) return <Connect />;
  if (session === undefined) return <div className="shell"><p className="muted">{t('Loading…')}</p></div>;

  if (!session) {
    // The installed app gets its own welcome screens instead of the marketing website.
    if (isApp && !['privacy', 'terms', 'contact'].includes(route.path)) return <Welcome />;
    if (isApp) return <div className="ax-info"><button className="btn small" onClick={() => go('')}>← {t('Back')}</button><Info page={route.path} /></div>;
    if (!PUBLIC.includes(route.path)) return <Landing />;
    const page = route.path === 'shop' ? <Shop ctx={null} query={route.query} />
      : ['privacy', 'terms', 'contact'].includes(route.path) ? <Info page={route.path} />
      : <Auth initial={route.path} key={route.path} />;
    return (
      <div className="site">
        <SiteHeader />
        <div className={route.path === 'signin' || route.path === 'signup' ? 'auth-wrap' : 'shell page-pad'}>{page}</div>
        <SiteFooter />
      </div>
    );
  }

  if (recovery) {
    return (
      <div className="auth-wrap"><div className="card narrow auth form">
        <Logo />
        <label className="field">{t('New password')}<input id="newpw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></label>
        {pwMsg && <p className="error">{pwMsg}</p>}
        <button className="btn primary" onClick={async () => {
          if (pw.length < 8) { setPwMsg(t('Use at least 8 characters.')); return; }
          const { error } = await supabase.auth.updateUser({ password: pw });
          if (error) setPwMsg(error.message); else setRecovery(false);
        }}>{t('Save new password')}</button>
      </div></div>
    );
  }

  if (isApp) {
    if (!profile) return <div className="ax-loading"><span className="logo-mark">அ</span><p className="muted">{profileErr ? t('Your account has no profile. Sign out and create the account again, or contact your teacher.') : t('Loading your account…')}</p>{profileErr && <button className="btn" onClick={() => supabase.auth.signOut()}>{t('Sign out')}</button>}</div>;
    return <AppShell profile={profile} setProfile={setProfile} onSettings={refreshSettings} />;
  }

  return (
    <div className="app">
      <header className="appbar noprint">
        <div className="container appbar-in">
          <Logo />
          <div className="who">
            <LangToggle profileId={profile?.id} className="outline-light" />
            <InstallButton />
            {!builtIn && <button className="btn small outline-light" onClick={forgetServer} title="Change server">Server</button>}
            {profile && <Bell profileId={profile.id} />}
            {profile && (
              <a className="userchip" href="#/account" title={t('My account')}>
                <span className="avatar" aria-hidden="true">{initials(profile.full_name || session.user.email)}</span>
                <span className="uname"><b>{profile.full_name || session.user.email}</b><small>{t(ROLE_LABEL[profile.role])}{profile.is_admin ? ` · ${t('Admin')}` : ''}</small></span>
              </a>
            )}
            <button className="btn small outline-light" onClick={() => { supabase.auth.signOut(); go(''); }}>{t('Sign out')}</button>
          </div>
        </div>
      </header>
      <div className="shell">
        {!profile && (profileErr
          ? <div className="card"><p>{t('Your account has no profile. Sign out and create the account again, or contact your teacher.')}</p></div>
          : <p className="muted">{t('Loading your account…')}</p>)}
        {profile && <Portal profile={profile} setProfile={setProfile} onSettings={refreshSettings} />}
      </div>
    </div>
  );
}
