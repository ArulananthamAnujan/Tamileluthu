import { useSyncExternalStore } from 'react';
import TA from './ta.js';

// Tamil / English switch. Text is written in English in the code and looked up
// in ta.js; anything not yet translated falls back to English.
const read = () => { try { return localStorage.getItem('tt-lang') === 'ta' ? 'ta' : 'en'; } catch { return 'en'; } };
let lang = read();
const subs = new Set();
if (typeof document !== 'undefined') document.documentElement.lang = lang;

export const getLang = () => lang;
export function setLang(l) {
  lang = l === 'ta' ? 'ta' : 'en';
  try { localStorage.setItem('tt-lang', lang); } catch { /* private mode */ }
  document.documentElement.lang = lang;
  subs.forEach((f) => f());
}
export function useLang() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, getLang);
}

// t('Linked to {name}.', { name }) → translated text with values filled in.
export function t(s, vars) {
  let r = lang === 'ta' && TA[s] ? TA[s] : s;
  if (vars) r = r.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return r;
}
// Pick the label for the current language from an { en, ta } pair.
export const tl = (o) => (o ? (lang === 'ta' && o.ta ? o.ta : o.en) : '');
