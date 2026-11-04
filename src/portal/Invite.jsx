import React, { useState } from 'react';
import { callFn, useRoster } from '../lib/scope.js';
import { t } from '../i18n.js';
import { SITE, schoolName } from '../site.js';
import { waLink } from '../lib/wa.js';
import { NeedsSetup } from './Setup.jsx';
import Icon from '../components/Icon.jsx';

export const joinLink = (code) => `${window.location.origin}/#/join?code=${encodeURIComponent(code)}`;
const splitEmails = (s) => [...new Set(s.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))];

// Teachers invite students: link, WhatsApp, their own email app, or the school mailbox.
export default function Invite({ ctx }) {
  if (ctx.role !== 'teacher') return <div className="card"><p>{t('Only teachers can invite students.')}</p></div>;
  if (!ctx.cls) return <NeedsSetup ctx={ctx} />;
  return <InviteCard cls={ctx.cls} />;
}

export function InviteCard({ cls }) {
  const roster = useRoster(cls.id);
  const [emails, setEmails] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = joinLink(cls.join_code);
  const text = t('Join {cls} on {site}: create a Student account at {url} and enter the class code {code}.', { cls: cls.name, site: schoolName(), url: link, code: cls.join_code });
  const list = splitEmails(emails);
  const subject = t('Join {cls} at {school}', { cls: cls.name, school: schoolName() });
  const mailto = `mailto:?bcc=${encodeURIComponent(list.join(','))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${note ? note + '\n\n' : ''}${text}\n\n${t('Parents: after your child joins, open their account to find the parent code and link your own Parent account.')}`)}`;

  async function copy() {
    try { await navigator.clipboard.writeText(`${text}`); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { window.prompt(t('Copy this link:'), link); }
  }
  async function sendSchool(e) {
    e.preventDefault(); setMsg('');
    if (!list.length) { setMsg(t('Add at least one valid email address.')); return; }
    setBusy(true);
    try {
      const r = await callFn('send-invites', { class_id: cls.id, emails: list, note });
      setMsg(t('Sent {a} of {b} invitations.', { a: r.sent, b: r.total })); if (r.sent) setEmails('');
    } catch (e2) { setMsg(t(e2.message)); }
    setBusy(false);
  }

  return (
    <div className="stack">
      <div className="row between wrap"><h2 className="title">{t('Invite students')} <span className="ta">· மாணவர்களை அழை</span></h2></div>
      <section className="card invite-hero">
        <div>
          <span className="kicker">{cls.name}</span>
          <p className="small muted">{t('Class code')}</p>
          <p className="bigcode">{cls.join_code}</p>
          <p className="small muted">{t('{n} students have joined so far.', { n: roster.length })}</p>
        </div>
        <div className="invite-ways">
          <button className="btn primary big" onClick={copy}><Icon name="share" size={18} />{copied ? t('Copied!') : t('Copy invite link')}</button>
          <a className="btn wa big" href={waLink(text)} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size={18} />{t('Send on WhatsApp')}</a>
        </div>
        <p className="small muted invite-link">{link}</p>
      </section>
      <section className="card form">
        <h3>{t('Invite by email')}</h3>
        <label className="field">{t('Student or parent emails (one per line, or separated by commas)')}
          <textarea rows={4} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder={'arun@example.com\nmeena@example.com'} />
        </label>
        <label className="field">{t('Message (optional)')}<textarea rows={2} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} /></label>
        <p className="small muted">{t('{n} valid addresses.', { n: list.length })}</p>
        <div className="row wrap">
          <a className={'btn' + (list.length ? '' : ' disabled')} href={list.length ? mailto : undefined} onClick={(e) => { if (!list.length) { e.preventDefault(); setMsg(t('Add at least one valid email address.')); } }}>
            <Icon name="mail" size={16} />{t('Open in my email app')}
          </a>
          <button className="btn primary" disabled={busy} onClick={sendSchool}>{busy ? t('Sending…') : t('Send from school email')}</button>
        </div>
        {msg && <p className="small" role="status">{msg}</p>}
        <p className="muted small">{t('“Open in my email app” uses your own Gmail/Outlook with everyone in BCC, so it works without any setup. “Send from school email” sends each invitation from the school mailbox once the admin has set it up.')}</p>
      </section>
      <section className="card notice">
        <h3>{t('What students do')}</h3>
        <ol className="small steps">
          <li>{t('Tap the link (or open the website) and create a Student account.')}</li>
          <li>{t('With the link, they join your class automatically. Otherwise they enter the class code.')}</li>
          <li>{t('Their account shows a parent code to give to their parents.')}</li>
        </ol>
      </section>
    </div>
  );
}
