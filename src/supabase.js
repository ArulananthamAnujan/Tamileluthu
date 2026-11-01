import { createClient } from '@supabase/supabase-js';

import { DEFAULT_SERVER } from './project-config.js';

// Override both values together for another deployment; never mix projects.
const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const settings = envUrl && envKey ? { url: envUrl, key: envKey } : DEFAULT_SERVER;
const { url, key } = settings;
export const builtIn = true;
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
  if (/email rate limit|over_email_send_rate_limit|rate limit exceeded/i.test(m)) return 'Too many sign-up or password emails were sent in the last hour, so the school’s email limit was reached. Please try again in an hour, or ask the school office to create the account.';
  if (/For security purposes, you can only request this after/i.test(m)) return 'Please wait a minute before asking for another email.';
  if (/User already registered/i.test(m)) return 'This email already has an account. Sign in instead, or use “Forgot password?”.';
  return m;
}


// Turn a failed Edge Function call into the function's own message (or a clear explanation).
export async function fnErrText(error, name = 'server') {
  if (!error) return '';
  const res = error.context;
  let body = null;
  try { body = res && typeof res.clone === 'function' ? await res.clone().json() : null; } catch { /* not JSON */ }
  if (body?.error) return body.error;
  const status = res?.status;
  if (status === 404) return `The ${name} function is not deployed yet. Ask the school admin to run: supabase functions deploy ${name}`;
  if (status === 401) return 'Please sign out and sign in again.';
  if (status === 546 || status === 500 || status === 502 || status === 503) {
    return `The ${name} function could not start or crashed (error ${status}). Ask the school admin to redeploy it and check Supabase → Edge Functions → ${name} → Logs.`;
  }
  if (/Failed to send a request|Failed to fetch|NetworkError/i.test(error.message || '')) return 'Cannot reach the server. Check your internet connection.';
  return status ? `${error.message} (error ${status})` : errText(error);
}
