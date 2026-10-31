import React, { useState } from 'react';
import { supabase, errText } from '../supabase.js';
import InstallButton from '../components/InstallButton.jsx';
import { t } from '../i18n.js';

const ROLES = [
  ['student', 'Student', 'Homework, listening exams, marks and writing feedback.'],
  ['parent', 'Parent', 'Your child’s homework, attendance, marks and reports.'],
  ['teacher', 'Teacher', 'For school staff. Your email must be registered by the school admin.'],
];

export default function Auth({ initial = 'signin', joining = false }) {
  const [mode, setMode] = useState(initial);
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
        if (!name.trim()) throw new Error(t('Please enter your full name.'));
        if (password.length < 8) throw new Error(t('Use a password of at least 8 characters.'));
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name.trim(), role }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) setMsg(t('Account created. Check your email and click the confirmation link, then sign in.'));
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setMsg(t('If that email has an account, a reset link is on its way.'));
      }
    } catch (e2) { setErr(t(errText(e2))); }
    setBusy(false);
  }

  return (
    <div className="stack">
      <div className="card narrow auth"><span className="auth-mark" aria-hidden="true">அ</span>
        <div className="row between"><h2 className="title">{mode === 'signup' ? t('Create your account') : mode === 'reset' ? t('Reset password') : t('Welcome back · வணக்கம்')}</h2><InstallButton /></div>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'on' : ''} onClick={() => setMode('signin')}>{t('Sign in')}</button>
          <button role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>{t('Create account')}</button>
        </div>
        {joining && (
          <p className="card notice small" role="status">
            {t('You have been invited to join a class. Create a Student account (or sign in), and you will be added to the class automatically.')}
          </p>
        )}
        <form onSubmit={submit} className="form">
          {mode === 'signup' && (
            <>
              <fieldset className="roles">
                <legend>{t('I am a…')}</legend>
                {ROLES.map(([k, l, d]) => (
                  <label key={k} className={'role' + (role === k ? ' on' : '')}>
                    <input type="radio" name="role" value={k} checked={role === k} onChange={() => setRole(k)} />
                    <b>{t(l)}</b><span>{t(d)}</span>
                  </label>
                ))}
              </fieldset>
              <label className="field">{t('Full name')}<input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
            </>
          )}
          <label className="field">{t('Email')}<input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          {mode !== 'reset' && (
            <label className="field">{t('Password')}<input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></label>
          )}
          {err && <p className="error">{err}</p>}
          {msg && <p className="ok">{msg}</p>}
          <button className="btn primary" disabled={busy}>
            {busy ? t('Please wait…') : mode === 'signin' ? t('Sign in') : mode === 'signup' ? t('Create account') : t('Send reset link')}
          </button>
          {mode === 'signin' && <button type="button" className="link" onClick={() => setMode('reset')}>{t('Forgot password?')}</button>}
          {mode === 'reset' && <button type="button" className="link" onClick={() => setMode('signin')}>{t('Back to sign in')}</button>}
        </form>
      </div>
    </div>
  );
}

