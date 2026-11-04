import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase.js';
import { t } from '../i18n.js';
import { go } from '../lib/util.js';
import { SITE } from '../site.js';
import { Logo } from './Landing.jsx';
import LangToggle from '../components/LangToggle.jsx';

// New student and parent accounts wait here until the school admin approves them.
export default function Pending({ profile, email, onCheck }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // Look again every 30 seconds, so the page opens by itself once approved.
  useEffect(() => {
    const timer = setInterval(onCheck, 30000);
    return () => clearInterval(timer);
  }, []);

  async function check() {
    setBusy(true); setMsg('');
    const p = await onCheck();
    setBusy(false);
    if (p && p.approved === false) setMsg(t('Not approved yet. Please check again later.'));
  }

  return (
    <div className="auth-wrap">
      <div className="card narrow auth form" role="status">
        <div className="row between"><Logo /><LangToggle profileId={profile.id} /></div>
        <h2 className="title">{t('Waiting for approval')}</h2>
        <p>{t('Thank you, {name}. Your {role} account has been created.', { name: profile.full_name || email, role: t(profile.role === 'parent' ? 'parent' : 'student') })}</p>
        <p>{t('The school will check and approve your account before you can join a class or use the site. You will be able to sign in as normal once it is approved.')}</p>
        <p className="small muted">{t('Signed in as {email}', { email })}{SITE.contactEmail ? ` · ${t('Questions?')} ${SITE.contactEmail}` : ''}</p>
        {msg && <p className="small">{msg}</p>}
        <div className="row wrap">
          <button className="btn primary" disabled={busy} onClick={check}>{busy ? t('Checking…') : t('Check again')}</button>
          <button className="btn" onClick={() => { supabase.auth.signOut(); go(''); }}>{t('Sign out')}</button>
        </div>
      </div>
    </div>
  );
}
