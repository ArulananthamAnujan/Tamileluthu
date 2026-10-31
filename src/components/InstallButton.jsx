import React, { useEffect, useState } from 'react';

// Shows "Install app" when the phone or browser allows adding the app to the home screen.
export default function InstallButton() {
  const [prompt, setPrompt] = useState(null);
  const [iosHint, setIosHint] = useState(false);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (standalone || /ThiruthiApp/.test(navigator.userAgent)) return null;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (prompt) {
    return <button className="btn small" onClick={async () => { prompt.prompt(); await prompt.userChoice; setPrompt(null); }}>Install app</button>;
  }
  if (isIOS) {
    return (
      <span className="install-ios">
        <button className="btn small" onClick={() => setIosHint(!iosHint)}>Install app</button>
        {iosHint && <span className="hint small">In Safari, tap Share, then <b>Add to Home Screen</b>.</span>}
      </span>
    );
  }
  return null;
}
