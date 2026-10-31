import { SITE } from '../site.js';

// wa.me needs the number in international form without "+" (0400… → 61400…).
export function waNumber(phone) {
  let d = String(phone || '').replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('+')) return d.slice(1);
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('0')) return SITE.phoneCountry + d.slice(1);
  return d;
}
export function waLink(text, phone) {
  const n = waNumber(phone);
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}
export const siteLink = (path = '') => `${window.location.origin}/#/${path}`;
