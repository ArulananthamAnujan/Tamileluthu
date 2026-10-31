import React, { useEffect, useState } from 'react';
import { supabase, configured, builtIn, forgetServer } from './supabase.js';
import { SITE } from './site.js';
import { useHash, go } from './lib/util.js';
import Connect from './components/Connect.jsx';
import Auth from './pages/Auth.jsx';
import Landing from './pages/Landing.jsx';
import Portal from './portal/Portal.jsx';
import Shop from './portal/Shop.jsx';
import InstallButton from './components/InstallButton.jsx';

const ROLE_LABEL = { student: 'Student', parent: 'Parent', teacher: 'Teacher' };

function Brand() {
  return <a className="brand" href="#/">{SITE.name.split(' ')[0]} <span>{SITE.name.split(' ').slice(1).join(' ')}</span></a>;
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [profileErr, setProfileErr] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [pw, setPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const route = useHash();

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
      .then(({ data, error }) => { if (!cancelled) { setProfile(data); setProfileErr(error ? 'Unable to load your account. Please sign out and try again.' : ''); } });
    return () => { cancelled = true; };
  }, [session?.user.id]);

  // After signing in from the sign-in page, continue where the visitor was going.
  useEffect(() => {
    if (session && (route.path === 'signin' || route.path === 'signup' || route.path === '')) go(route.query.get('next') || 'today');
  }, [session, route.path]);

  useEffect(() => { document.title = `${SITE.nameEn} · ${SITE.school}`; }, []);

  if (!configured) return <Connect />;
  if (session === undefined) return <div className="shell"><p className="muted">Loading…</p></div>;

  if (!session) {
    const page = route.path === 'signin' || route.path === 'signup'
      ? <Auth initial={route.path} key={route.path} />
      : route.path === 'shop' ? <Shop ctx={null} query={route.query} /> : <Landing />;
    return (
      <div className="shell">
        <header className="top">
          <Brand />
          <nav className="who">
            <a className="btn small ghost" href="#/shop">Papers</a>
            <InstallButton />
            <a className="btn small primary" href="#/signin">Sign in</a>
          </nav>
        </header>
        {page}
      </div>
    );
  }

  if (recovery) {
    return (
      <div className="shell"><div className="card narrow form">
        <Brand />
        <label className="field">New password<input id="newpw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></label>
        {pwMsg && <p className="error">{pwMsg}</p>}
        <button className="btn primary" onClick={async () => {
          if (pw.length < 8) { setPwMsg('Use at least 8 characters.'); return; }
          const { error } = await supabase.auth.updateUser({ password: pw });
          if (error) setPwMsg(error.message); else setRecovery(false);
        }}>Save new password</button>
      </div></div>
    );
  }

  return (
    <div className="shell">
      <header className="top noprint">
        <Brand />
        <div className="who">
          {profile && <span>{profile.full_name || session.user.email} · <b>{ROLE_LABEL[profile.role]}</b></span>}
          <InstallButton />
          {!builtIn && <button className="btn small" onClick={forgetServer} title="Change server">Server</button>}
          <button className="btn small" onClick={() => { supabase.auth.signOut(); go(''); }}>Sign out</button>
        </div>
      </header>
      {!profile && (profileErr
        ? <div className="card"><p>Your account has no profile ({profileErr}). Sign out and create the account again, or contact your teacher.</p></div>
        : <p className="muted">Loading your account…</p>)}
      {profile && <Portal profile={profile} setProfile={setProfile} />}
    </div>
  );
}
