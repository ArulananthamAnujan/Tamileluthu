import { useEffect, useState } from 'react';
import { getLang, t } from '../i18n.js';

// Local calendar date as YYYY-MM-DD (not UTC, so evening classes stay on the right day).
export function isoDay(d = new Date()) {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 10);
}
export function addDays(day, n) {
  const d = new Date(day + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return isoDay(d);
}
export const fmtDay = (day, opts) => day
  ? new Date(day + (day.length === 10 ? 'T12:00:00' : '')).toLocaleDateString(getLang() === 'ta' ? 'ta-IN' : 'en-AU', opts || { weekday: 'short', day: 'numeric', month: 'short' })
  : '';
export const money = (cents, cur = 'aud') => cents
  ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: cur.toUpperCase() }).format(cents / 100)
  : t('Free');
export const pct = (mark, max) => (mark == null || !max ? null : Math.round((Number(mark) / Number(max)) * 100));

// Tiny hash router: "#/marks?x=1" → { path: 'marks', query: URLSearchParams }.
export function useHash() {
  const read = () => {
    const h = window.location.hash.replace(/^#\/?/, '');
    const [path, q = ''] = h.split('?');
    return { path: path || '', query: new URLSearchParams(q) };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
export const go = (path) => { window.location.hash = '/' + path; };

export function safeUrl(u) {
  return /^https?:\/\//i.test(u || '') ? u : null;
}
