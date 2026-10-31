import React, { useEffect, useState } from 'react';
import { supabase, configured, builtIn, forgetServer } from './supabase.js';
import Connect from './components/Connect.jsx';
import Auth from './pages/Auth.jsx';
import Student from './pages/Student.jsx';
import Parent from './pages/Parent.jsx';
import Teacher from './pages/Teacher.jsx';
import InstallButton from './components/InstallButton.jsx';

const ROLE_LABEL = { student: 'Student', parent: 'Parent', teacher: 'Teacher' };

export default function App() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [profileErr, setProfileErr] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [pw, setPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');

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
    if (!session) { setProfile(null); return; }
    supabase.from('profiles').select('*').eq('id', session.user.id).single()
      .then(({ data, error }) => { setProfile(data); setProfileErr(error ? error.message : ''); });
  }, [session]);

  if (!configured) return <Connect />;
  if (session === undefined) return <div className="shell"><p className="muted">Loading…</p></div>;
  if (!session) return <Auth />;
  if (recovery) {
    return (
      <div className="shell"><div className="card narrow form">
        <h1 className="brand">தமிழ் <span>திருத்தி</span></h1>
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
      <header className="top">
        <h1 className="brand">தமிழ் <span>திருத்தி</span></h1>
        <div className="who">
          {profile && <span>{profile.full_name || session.user.email} · <b>{ROLE_LABEL[profile.role]}</b></span>}
          <InstallButton />
          {!builtIn && <button className="btn small" onClick={forgetServer} title="Change server">Server</button>}
          <button className="btn small" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>
      {!profile && (profileErr
        ? <div className="card"><p>Your account has no profile ({profileErr}). Sign out and create the account again, or contact your teacher.</p></div>
        : <p className="muted">Loading your account…</p>)}
      {profile?.role === 'student' && <Student profile={profile} setProfile={setProfile} />}
      {profile?.role === 'parent' && <Parent profile={profile} />}
      {profile?.role === 'teacher' && <Teacher profile={profile} />}
    </div>
  );
}
