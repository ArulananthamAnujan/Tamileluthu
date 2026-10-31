import React, { useState } from 'react';
import { supabase, errText } from '../supabase.js';
import { t } from '../i18n.js';

export function JoinClass({ onDone }) {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  async function join(e) {
    e.preventDefault(); setMsg('');
    const { data, error } = await supabase.rpc('join_class', { code });
    if (error) { setMsg(errText(error)); return; }
    setMsg(t('You joined {name}.', { name: data })); setCode(''); onDone?.();
  }
  return (
    <form className="row wrap" onSubmit={join}>
      <input className="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('Class code')} maxLength={6} aria-label={t('Class code')} />
      <button className="btn primary">{t('Join class')}</button>
      {msg && <p className="small" role="status">{msg}</p>}
    </form>
  );
}

export function LinkChild({ onDone }) {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  async function link(e) {
    e.preventDefault(); setMsg('');
    const { data, error } = await supabase.rpc('link_child', { code });
    if (error) { setMsg(errText(error)); return; }
    setMsg(t('Linked to {name}.', { name: data || t('your child') })); setCode(''); onDone?.();
  }
  return (
    <form className="row wrap" onSubmit={link}>
      <input className="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('Parent code')} maxLength={8} aria-label={t('Parent code')} />
      <button className="btn primary">{t('Link child')}</button>
      {msg && <p className="small" role="status">{msg}</p>}
    </form>
  );
}

export function NewClass({ profile, onDone }) {
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  async function create(e) {
    e.preventDefault(); setMsg('');
    if (!name.trim()) return;
    const { error } = await supabase.from('classes').insert({ name: name.trim(), teacher_id: profile.id });
    if (error) { setMsg(errText(error)); return; }
    setName(''); onDone?.();
  }
  return (
    <form className="row wrap" onSubmit={create}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Year 5 Tamil')} aria-label={t('Class name')} />
      <button className="btn primary">{t('Create class')}</button>
      {msg && <p className="error small">{msg}</p>}
    </form>
  );
}

// Shown when there is nothing to look at yet.
export function NeedsSetup({ ctx }) {
  const { role, profile, reload } = ctx;
  if (role === 'teacher') return (
    <section className="card notice">
      <h3>{t('Create your first class')}</h3>
      <p>{t('You get a 6-letter class code. Students enter it after signing up; parents then link with their child’s parent code.')}</p>
      <NewClass profile={profile} onDone={reload} />
    </section>
  );
  if (role === 'student') return (
    <section className="card notice">
      <h3>{t('Join your class')}</h3>
      <p>{t('Ask your teacher for the class code.')}</p>
      <JoinClass onDone={reload} />
    </section>
  );
  return (
    <section className="card notice">
      <h3>{ctx.scope.children.length ? t('Your child is not in a class yet') : t('Link your child')}</h3>
      {ctx.scope.children.length
        ? <p>{t('Ask your child to join their class with the class code from their teacher.')}</p>
        : <><p>{t('Your child’s parent code is on their My account page. Enter it here.')}</p><LinkChild onDone={reload} /></>}
    </section>
  );
}
