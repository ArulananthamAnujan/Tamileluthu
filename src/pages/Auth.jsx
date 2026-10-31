import React, { useState } from 'react';
import { supabase, errText } from '../supabase.js';
import InstallButton from '../components/InstallButton.jsx';

const ROLES = [
  ['student', 'Student', 'Upload your writing and get feedback.'],
  ['parent', 'Parent', 'See your child’s writing and mistakes.'],
  ['teacher', 'Teacher', 'For school staff. Your email must be registered.'],
];

export default function Auth() {
  const [mode, setMode] = useState('signin');
  const [role, setRole] = useState('student');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr(''); setMsg(''); setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'signup') {
        if (!name.trim()) throw new Error('Please enter your full name.');
        if (password.length < 8) throw new Error('Use a password of at least 8 characters.');
        if (role === 'teacher') {
          const { data: ok } = await supabase.rpc('is_teacher_email', { e: email });
          if (!ok) throw new Error('This email is not registered as a teacher. Ask the school to add it.');
        }
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name.trim(), role }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) setMsg('Account created. Check your email and click the confirmation link, then sign in.');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setMsg('If that email has an account, a reset link is on its way.');
      }
    } catch (e2) { setErr(errText(e2)); }
    setBusy(false);
  }

  return (
    <div className="shell">
      <div className="card narrow auth">
        <h1 className="brand">தமிழ் <span>திருத்தி</span></h1>
        <div className="row between"><p className="muted" style={{margin:0}}>Tamil writing feedback for students, parents and teachers.</p><InstallButton /></div>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'on' : ''} onClick={() => setMode('signin')}>Sign in</button>
          <button role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>Create account</button>
        </div>
        <form onSubmit={submit} className="form">
          {mode === 'signup' && (
            <>
              <fieldset className="roles">
                <legend>I am a…</legend>
                {ROLES.map(([k, l, d]) => (
                  <label key={k} className={'role' + (role === k ? ' on' : '')}>
                    <input type="radio" name="role" value={k} checked={role === k} onChange={() => setRole(k)} />
                    <b>{l}</b><span>{d}</span>
                  </label>
                ))}
              </fieldset>
              <label className="field">Full name<input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
            </>
          )}
          <label className="field">Email<input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          {mode !== 'reset' && (
            <label className="field">Password<input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></label>
          )}
          {err && <p className="error">{err}</p>}
          {msg && <p className="ok">{msg}</p>}
          <button className="btn primary" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
          </button>
          {mode === 'signin' && <button type="button" className="link" onClick={() => setMode('reset')}>Forgot password?</button>}
          {mode === 'reset' && <button type="button" className="link" onClick={() => setMode('signin')}>Back to sign in</button>}
        </form>
      </div>
    </div>
  );
}
