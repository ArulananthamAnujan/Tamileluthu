import { useSyncExternalStore } from 'react';

// Personal app settings, kept on this device.
export const THEMES = {
  peacock: { en: 'Peacock', ta: 'மயில்', swatch: ['#0E5E63', '#C9962B'], bar: '#0B3536' },
  lotus: { en: 'Lotus', ta: 'தாமரை', swatch: ['#8E2443', '#D9A441'], bar: '#5A1229' },
  mango: { en: 'Mango', ta: 'மாம்பழம்', swatch: ['#2F6B2F', '#E08A1E'], bar: '#1E4A1E' },
  ocean: { en: 'Ocean', ta: 'கடல்', swatch: ['#1F4E8C', '#E0B04A'], bar: '#14365F' },
  night: { en: 'Night', ta: 'இரவு', swatch: ['#121D20', '#E2B357'], bar: '#061B1C' },
};
export const HOME_CARDS = {
  word: { en: 'Word of the day', ta: 'இன்றைய சொல்' },
  next: { en: 'Next up', ta: 'அடுத்தது' },
  stats: { en: 'My progress', ta: 'முன்னேற்றம்' },
  actions: { en: 'Quick actions', ta: 'விரைவுச் செயல்கள்' },
};

const KEY = 'tt-prefs';
const DEFAULTS = { theme: 'peacock', text: 'md', hidden: [], nickname: '' };
let prefs = (() => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; } })();
const subs = new Set();

function apply() {
  const root = document.documentElement;
  root.dataset.theme = prefs.theme;
  root.dataset.text = prefs.text;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', (THEMES[prefs.theme] || THEMES.peacock).bar);
}
apply();

export const getPrefs = () => prefs;
export function setPrefs(patch) {
  prefs = { ...prefs, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* private mode */ }
  apply();
  subs.forEach((f) => f());
}
export function usePrefs() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, getPrefs);
}
