import React, { useEffect, useState } from 'react';
import { t } from '../i18n.js';
import Icon from './Icon.jsx';

// Shows "Install app" when the phone or browser allows adding the app to the home screen.
export default function InstallButton() {
  const [prompt, setPrompt] = useState(null);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (standalone || /ThiruthiApp/.test(navigator.userAgent)) return null;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  if (prompt) {
    return <button className="btn small" onClick={async () => { prompt.prompt(); await prompt.userChoice; setPrompt(null); }}><Icon name="phone" size={15} />{t('Install app')}</button>;
  }
  if (isIOS) return <a className="btn small" href="#/install"><Icon name="phone" size={15} />{t('Install app')}</a>;
  return null;
}
