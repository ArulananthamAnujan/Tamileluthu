import React, { useState } from 'react';
import { saveServer } from '../supabase.js';

// Shown only when the app was built without server settings.
export default function Connect() {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [err, setErr] = useState('');
  function submit(e) {
    e.preventDefault();
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url.trim())) { setErr('The server address looks like https://xxxx.supabase.co'); return; }
    if (key.trim().length < 30) { setErr('Paste the full anon public key.'); return; }
    saveServer(url, key);
  }
  return (
    <div className="shell"><div className="card narrow form">
      <h1 className="brand">தமிழ் <span>திருத்தி</span></h1>
      <p>Connect this app to your school’s server. You only do this once on this phone.</p>
      <p className="muted small">Your teacher has these two details (Supabase → Project Settings → API).</p>
      <form className="form" onSubmit={submit}>
        <label className="field">Server address<input id="srvUrl" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" autoCapitalize="off" autoCorrect="off" /></label>
        <label className="field">Anon public key<input id="srvKey" value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJ…" autoCapitalize="off" autoCorrect="off" /></label>
        {err && <p className="error">{err}</p>}
        <button className="btn primary">Connect</button>
      </form>
    </div></div>
  );
}
