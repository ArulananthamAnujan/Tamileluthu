import { createClient } from '@supabase/supabase-js';

// Server settings come from the build (.env), or — in the Android app before the
// final build — from a one-time "Connect" screen saved on the phone.
function stored() {
  try { return JSON.parse(localStorage.getItem('tt-server') || 'null'); } catch { return null; }
}
const saved = stored();
const url = import.meta.env.VITE_SUPABASE_URL || saved?.url;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || saved?.key;

export const builtIn = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
export const configured = Boolean(url && key);
export const supabase = configured ? createClient(url, key) : null;
export const inApp = /ThiruthiApp/.test(navigator.userAgent);

export function saveServer(u, k) {
  localStorage.setItem('tt-server', JSON.stringify({ url: u.trim().replace(/\/+$/, ''), key: k.trim() }));
  window.location.reload();
}
export function forgetServer() {
  localStorage.removeItem('tt-server');
  window.location.reload();
}

// Turn a Supabase / Postgres error into a sentence for the screen.
export function errText(e) {
  if (!e) return '';
  const m = e.message || String(e);
  if (/Invalid login credentials/i.test(m)) return 'The email or password is wrong.';
  if (/Email not confirmed/i.test(m)) return 'Please confirm your email first. Check your inbox for the link.';
  if (/Database error saving new user/i.test(m)) return 'This email is not registered as a teacher. Ask the school to add it.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Cannot reach the server. Check your internet connection.';
  return m;
}
