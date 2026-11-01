import React, { useEffect, useState } from 'react';
import { t, getLang } from '../i18n.js';
import { SITE } from '../site.js';
import { isIOS, isAndroid, inAppBrowser, isInstalled } from '../lib/device.js';
import Icon from '../components/Icon.jsx';

// iOS share icon (square with an arrow), as it looks in Safari.
const ShareIOS = () => (
  <svg className="ios-ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
);
const PlusSquare = () => (
  <svg className="ios-ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8M8 12h8" />
  </svg>
);

export function OpenInBrowser() {
  const [copied, setCopied] = useState(false);
  const url = window.location.origin + '/#/install';
  return (
    <div className="card notice inapp">
      <h3>{t('Open this page in {browser} first', { browser: isIOS ? 'Safari' : 'Chrome' })}</h3>
      <p className="small">{t('You opened the link inside WhatsApp / Instagram / Facebook. Their built-in browser cannot install apps.')}</p>
      <ol className="small steps">
        <li>{isIOS ? t('Tap ••• or the compass icon at the bottom right, then “Open in Safari”.') : t('Tap ⋮ at the top right, then “Open in Chrome”.')}</li>
        <li>{t('Or copy the link and paste it into {browser}.', { browser: isIOS ? 'Safari' : 'Chrome' })}</li>
      </ol>
      <button className="btn primary" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { window.prompt(t('Copy this link:'), url); } }}>
        {copied ? t('Copied!') : t('Copy link')}
      </button>
    </div>
  );
}

function IPhoneSteps() {
  return (
    <ol className="isteps">
      <li><span className="inum">1</span><div><b>{t('Open the website in Safari')}</b><p className="small muted">{t('On iOS 16.4 or newer, Chrome and Edge also work.')}</p></div></li>
      <li><span className="inum">2</span><div><b>{t('Tap the Share button')} <ShareIOS /></b><p className="small muted">{t('At the bottom of the screen (on iPad, at the top). If you cannot see it, scroll up a little.')}</p></div></li>
      <li><span className="inum">3</span><div><b>{t('Scroll down and tap “Add to Home Screen”')} <PlusSquare /></b><p className="small muted">{t('If it is missing, tap “Edit Actions…” at the bottom of the list and add it.')}</p></div></li>
      <li><span className="inum">4</span><div><b>{t('Tap “Add”')}</b><p className="small muted">{t('The app icon appears on your home screen. Open it from there — it works like a normal app, full screen.')}</p></div></li>
    </ol>
  );
}
function AndroidSteps() {
  return (
    <ol className="isteps">
      <li><span className="inum">1</span><div><b>{t('Open the website in Chrome')}</b></div></li>
      <li><span className="inum">2</span><div><b>{t('Tap “Install app”')}</b><p className="small muted">{t('Shown at the bottom of the screen or in the ⋮ menu (“Install app” or “Add to Home screen”).')}</p></div></li>
      <li><span className="inum">3</span><div><b>{t('Tap “Install”')}</b><p className="small muted">{t('The app appears with your other apps. The school may also give you the Android app file (.apk).')}</p></div></li>
    </ol>
  );
}

export default function Install() {
  const [tab, setTab] = useState(isAndroid ? 'android' : 'iphone');
  const [prompt, setPrompt] = useState(null);
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);
  const link = window.location.origin;
  return (
    <div className="stack install">
      <div className="install-hero card">
        <span className="logo-mark big">{SITE.logoUrl ? <img src={SITE.logoUrl} alt="" /> : 'அ'}</span>
        <div>
          <h2 className="title">{t('Install the app')} <span className="ta">· செயலியை நிறுவுக</span></h2>
          <p className="small muted">{SITE.school} · {t('Free · no App Store needed · always up to date')}</p>
        </div>
      </div>
      {isInstalled() && <div className="card notice"><b>✓ {t('The app is already installed on this device.')}</b></div>}
      {inAppBrowser && <OpenInBrowser />}
      {prompt && !isInstalled() && (
        <button className="btn gold big" onClick={async () => { prompt.prompt(); await prompt.userChoice; setPrompt(null); }}>
          <Icon name="phone" size={18} />{t('Install now')}
        </button>
      )}
      <div className="tabs">
        <button className={tab === 'iphone' ? 'on' : ''} onClick={() => setTab('iphone')}>iPhone / iPad</button>
        <button className={tab === 'android' ? 'on' : ''} onClick={() => setTab('android')}>Android</button>
      </div>
      <section className="card">{tab === 'iphone' ? <IPhoneSteps /> : <AndroidSteps />}</section>
      <section className="card small">
        <h3>{t('Send these steps to parents')}</h3>
        <p className="muted">{t('Share this link in your class WhatsApp group:')} <b>{link}/#/install</b></p>
        <a className="btn wa small" target="_blank" rel="noopener noreferrer"
          href={`https://wa.me/?text=${encodeURIComponent(`${getLang() === 'ta' ? 'எமது பள்ளிச் செயலியை நிறுவ:' : 'Install our school app:'} ${link}/#/install`)}`}>
          <Icon name="whatsapp" size={15} />{t('Share on WhatsApp')}</a>
      </section>
    </div>
  );
}

// Shown once to iPhone visitors in Safari who have not installed the app yet.
export function IOSInstallTip() {
  const key = 'tt-ios-tip';
  const [show, setShow] = useState(() => {
    try { return isIOS && !isInstalled() && !localStorage.getItem(key); } catch { return false; }
  });
  if (!show) return null;
  const close = () => { try { localStorage.setItem(key, '1'); } catch { /* private mode */ } setShow(false); };
  return (
    <div className="ios-tip" role="dialog" aria-label={t('Install the app')}>
      <button className="ios-tip-x" onClick={close} aria-label={t('Close')}><Icon name="x" size={16} /></button>
      <b>{t('Install the app on your iPhone')}</b>
      {inAppBrowser
        ? <p className="small">{t('First open this page in Safari, then tap Share → Add to Home Screen.')}</p>
        : <p className="small">{t('Tap')} <ShareIOS /> {t('then')} <b>{t('“Add to Home Screen”')}</b> <PlusSquare /></p>}
      <a className="small" href="#/install" onClick={close}>{t('Show me the steps')}</a>
    </div>
  );
}
