import React, { useEffect, useState } from 'react';
import { supabase, errText } from '../supabase.js';
import { t, useLang, setLang } from '../i18n.js';
import { SITE } from '../site.js';
import { siteLink } from '../lib/wa.js';
import { JoinClass, LinkChild } from './Setup.jsx';
import WaButton from '../components/Wa.jsx';

const PHONE = /^\+?[0-9][0-9 ()-]{5,19}$/;

export default function Account({ ctx, setProfile }) {
  const { profile, role } = ctx;
  const lang = useLang();
  const [f, setF] = useState({ full_name: profile.full_name || '', phone: profile.phone || '' });
  const [msg, setMsg] = useState('');
  const [pw, setPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [links, setLinks] = useState([]);

  async function loadLinks() {
    if (role === 'student') {
      const { data } = await supabase.from('parent_links').select('parent_id, parent:profiles!parent_links_parent_id_fkey(full_name)').eq('student_id', profile.id);
      setLinks((data || []).map((l) => ({ id: l.parent_id, name: l.parent?.full_name || t('Parent') })));
    } else if (role === 'parent') {
      const { data } = await supabase.from('parent_links').select('student_id, student:profiles!parent_links_student_id_fkey(full_name)').eq('parent_id', profile.id);
      setLinks((data || []).map((l) => ({ id: l.student_id, name: l.student?.full_name || t('Student') })));
    }
  }
  useEffect(() => { loadLinks(); }, []);

  async function save(e) {
    e.preventDefault(); setMsg('');
    const row = { full_name: f.full_name.trim(), phone: f.phone.trim() || null, lang };
    if (!row.full_name) { setMsg(t('Please enter your name.')); return; }
    if (row.phone && !PHONE.test(row.phone)) { setMsg(t('Enter a mobile number like 0400 123 456 or +61 400 123 456.')); return; }
    const { data, error } = await supabase.from('profiles').update(row).eq('id', profile.id).select().single();
    if (error) { setMsg(errText(error)); return; }
    setProfile(data); setMsg(t('Saved.'));
  }
  async function newCode() {
    const { data, error } = await supabase.rpc('new_parent_code');
    if (!error) setProfile({ ...profile, parent_code: data });
  }
  async function unlink(id) {
    if (!confirm(t('Remove this link?'))) return;
    if (role === 'student') await supabase.from('parent_links').delete().eq('parent_id', id).eq('student_id', profile.id);
    else await supabase.from('parent_links').delete().eq('parent_id', profile.id).eq('student_id', id);
    loadLinks(); ctx.reload();
  }
  async function changePw(e) {
    e.preventDefault(); setPwMsg('');
    if (pw.length < 8) { setPwMsg(t('Use at least 8 characters.')); return; }
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwMsg(error ? errText(error) : t('Password changed.')); if (!error) setPw('');
  }

  return (
    <div className="stack">
      <h2 className="title">{t('My account')} <span className="ta">· என் கணக்கு</span></h2>
      <div className="grid2">
        <section className="card">
          <h3>{t('Your details')}</h3>
          <form className="form" onSubmit={save}>
            <label className="field">{t('Full name')}<input value={f.full_name} maxLength={120} onChange={(e) => setF({ ...f, full_name: e.target.value })} autoComplete="name" /></label>
            {role !== 'student' && (
              <label className="field">{t('Mobile number (for WhatsApp)')}
                <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" autoComplete="tel" placeholder="0400 123 456" />
              </label>
            )}
            {role === 'parent' && <p className="muted small">{t('Only your child’s class teachers can see your number. They use it to WhatsApp you about your child.')}</p>}
            <fieldset className="langpick">
              <legend>{t('Language')} · மொழி</legend>
              <label className={'role' + (lang === 'en' ? ' on' : '')}><input type="radio" name="lang" checked={lang === 'en'} onChange={() => setLang('en')} /><b>English</b><span>{t('Menus and help in English')}</span></label>
              <label className={'role' + (lang === 'ta' ? ' on' : '')}><input type="radio" name="lang" checked={lang === 'ta'} onChange={() => setLang('ta')} /><b>தமிழ்</b><span>பட்டியல்களும் உதவியும் தமிழில்</span></label>
            </fieldset>
            {msg && <p className="small" role="status">{msg}</p>}
            <button className="btn primary">{t('Save')}</button>
          </form>
        </section>
        <aside className="stack">
          {role !== 'teacher' && (
            <a className="card link-card row between" href="#/subscription">
              <span><b>{t('Subscription')}</b><br /><span className="small muted">{t('Monthly access to the தமிழ் திருத்தி writing checker')}</span></span>
              <span className="btn small gold">{t('Open')}</span>
            </a>
          )}
          {role === 'student' && (
            <section className="card">
              <h3>{t('Parent code')}</h3>
              <p className="muted small">{t('Give this code to your parent. They enter it in their account to see your homework, marks, reports and writing.')}</p>
              <p className="bigcode">{profile.parent_code}</p>
              <div className="row wrap">
                <WaButton text={t('Please link to my school account. Create a Parent account at {url} and enter my parent code: {code}', { url: siteLink('signup'), code: profile.parent_code })} label={t('Send to parent')} />
                <button className="btn small" onClick={newCode}>{t('Make a new code')}</button>
              </div>
              {links.length > 0 && (<>
                <p className="label">{t('Linked parents')}</p>
                <ul className="plain">{links.map((p) => <li key={p.id} className="row between">{p.name}<button className="btn small" onClick={() => unlink(p.id)}>{t('Remove')}</button></li>)}</ul>
              </>)}
            </section>
          )}
          {role === 'student' && (
            <section className="card">
              <h3>{t('My classes')}</h3>
              {ctx.scope.classes.length
                ? <ul className="plain">{ctx.scope.classes.map((c) => <li key={c.id}><b>{c.name}</b>{c.teacher?.full_name ? ` · ${c.teacher.full_name}` : ''}</li>)}</ul>
                : <p className="muted small">{t('Join your class so your teacher can see your work.')}</p>}
              <JoinClass onDone={ctx.reload} />
            </section>
          )}
          {role === 'parent' && (
            <section className="card">
              <h3>{t('My children')}</h3>
              {links.length
                ? <ul className="plain">{links.map((k) => <li key={k.id} className="row between">{k.name}<button className="btn small" onClick={() => unlink(k.id)}>{t('Remove')}</button></li>)}</ul>
                : <p className="muted small">{t('No children linked yet.')}</p>}
              <p className="muted small">{t('Add another child with their parent code:')}</p>
              <LinkChild onDone={() => { loadLinks(); ctx.reload(); }} />
            </section>
          )}
          <section className="card">
            <h3>{t('Password')}</h3>
            <form className="row wrap" onSubmit={changePw}>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t('New password')} autoComplete="new-password" className="grow" />
              <button className="btn">{t('Change')}</button>
            </form>
            {pwMsg && <p className="small" role="status">{pwMsg}</p>}
          </section>
          {(SITE.contactEmail || SITE.contactPhone) && (
            <section className="card">
              <h3>{t('Need help?')}</h3>
              <p className="small">{t('Contact the school:')} {SITE.contactEmail && <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>} {SITE.contactPhone}</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
