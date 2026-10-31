// The app experience is used inside the Android app, when the site is installed
// to a home screen, or when opened with ?app=1 (handy for testing on a computer).
const q = new URLSearchParams(window.location.search).get('app');
try {
  if (q === '1') localStorage.setItem('tt-app', '1');
  if (q === '0') localStorage.removeItem('tt-app');
} catch { /* private mode */ }
const forced = (() => { try { return localStorage.getItem('tt-app') === '1'; } catch { return false; } })();
export const isApp = forced
  || /ThiruthiApp/.test(navigator.userAgent)
  || window.matchMedia?.('(display-mode: standalone)').matches
  || window.navigator.standalone === true;
if (isApp) document.documentElement.classList.add('is-app');

// A short buzz on Android for taps that change something.
export const buzz = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* not supported */ } };
