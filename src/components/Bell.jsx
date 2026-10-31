import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase.js';
import { t, getLang } from '../i18n.js';
import Icon from './Icon.jsx';

const ago = (iso) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return t('just now');
  if (m < 60) return t('{n} min ago', { n: m });
  if (m < 1440) return t('{n} h ago', { n: Math.round(m / 60) });
  return new Date(iso).toLocaleDateString(getLang() === 'ta' ? 'ta-IN' : 'en-AU', { day: 'numeric', month: 'short' });
};

// Notification bell: new homework, results, reports and comments.
export default function Bell({ profileId }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const seen = useRef(null);
  const box = useRef(null);

  async function load() {
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id', profileId)
      .order('created_at', { ascending: false }).limit(30);
    if (error) return;
    const list = data || [];
    // A phone/desktop alert while the app is open, if the person allowed it.
    if (seen.current && 'Notification' in window && Notification.permission === 'granted') {
      list.filter((n) => !n.read_at && !seen.current.has(n.id)).slice(0, 3).forEach((n) => {
        try { new Notification(n.title, { body: n.body || '', icon: '/icon-192.png', tag: n.id }); } catch { /* not supported */ }
      });
    }
    seen.current = new Set(list.map((n) => n.id));
    setItems(list);
  }
  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [profileId]);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const unread = items.filter((n) => !n.read_at);
  async function readAll() {
    if (!unread.length) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unread.map((n) => n.id));
    load();
  }
  async function openItem(n) {
    if (!n.read_at) await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
    setOpen(false);
    if (n.link?.startsWith('#/')) window.location.hash = n.link.slice(1);
    load();
  }
  const canAsk = 'Notification' in window && Notification.permission === 'default';

  return (
    <div className="bell" ref={box}>
      <button className="btn small outline-light bellbtn" onClick={() => setOpen(!open)} aria-expanded={open}
        aria-label={t('Notifications ({n} new)', { n: unread.length })}>
        <Icon name="bell" size={18} />
        {unread.length > 0 && <span className="badge">{unread.length > 9 ? '9+' : unread.length}</span>}
      </button>
      {open && (
        <div className="bellpanel" role="dialog" aria-label={t('Notifications')}>
          <div className="row between bellhead">
            <b>{t('Notifications')}</b>
            {unread.length > 0 && <button className="link small" onClick={readAll}>{t('Mark all as read')}</button>}
          </div>
          {canAsk && (
            <button className="bellask small" onClick={() => Notification.requestPermission().then(() => setOpen(true))}>
              <Icon name="bell" size={14} /> {t('Show alerts on this device while the app is open')}
            </button>
          )}
          {!items.length ? <p className="muted small bellempty">{t('Nothing new. Homework, results, reports and teacher comments will appear here.')}</p> : (
            <ul className="belllist">
              {items.map((n) => (
                <li key={n.id}>
                  <button className={'bellitem' + (n.read_at ? '' : ' unread')} onClick={() => openItem(n)}>
                    <span className={`bk bk-${n.kind}`} aria-hidden="true" />
                    <span className="bt"><b>{n.title}</b>{n.body && <small>{n.body}</small>}<small className="muted">{ago(n.created_at)}</small></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
