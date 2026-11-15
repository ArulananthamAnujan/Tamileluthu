import React, { useState } from 'react';
import { supabase } from '../supabase.js';
import { t } from '../i18n.js';
import { youtubeId, youtubeEmbedUrl, youtubeThumb, youtubeWatchUrl, fileExt, fmtSize } from '../lib/media.js';

// A YouTube video that plays inside the page. It loads only after the first tap,
// so a long diary stays fast and nothing is sent to YouTube until then.
export function YouTube({ url, title }) {
  const id = youtubeId(url);
  const [play, setPlay] = useState(false);
  if (!id) return null;
  return (
    <div className="yt">
      <div className="yt-frame">
        {play ? (
          <iframe src={youtubeEmbedUrl(id)} title={title || t('Video')} loading="lazy" allowFullScreen
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin" />
        ) : (
          <button type="button" className="yt-poster" onClick={() => setPlay(true)} aria-label={t('Play video')}>
            <img src={youtubeThumb(id)} alt="" loading="lazy" />
            <span className="yt-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30"><path d="M8 5v14l11-7z" fill="currentColor" /></svg></span>
          </button>
        )}
      </div>
      <a className="small" href={youtubeWatchUrl(id)} target="_blank" rel="noopener noreferrer">{t('Open on YouTube')} ↗</a>
    </div>
  );
}

// Files attached to a diary post. Each opens through a short-lived private link.
export function Files({ files }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(null);
  if (!files?.length) return null;
  async function open(f) {
    setMsg(''); setBusy(f.path);
    const name = (f.name || '').replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 120) || true;
    const { data, error } = await supabase.storage.from('homework').createSignedUrl(f.path, 300, { download: name });
    setBusy(null);
    if (error || !data?.signedUrl) { setMsg(t('This file could not be opened. Ask your teacher to attach it again.')); return; }
    window.location.href = data.signedUrl;
  }
  return (
    <div className="files">
      {files.map((f) => (
        <button key={f.path} type="button" className="file" onClick={() => open(f)} disabled={busy === f.path}>
          <span className="file-ext" aria-hidden="true">{fileExt(f.name) || fileExt(f.path)}</span>
          <span className="file-name">{f.name}</span>
          {f.size ? <span className="small muted">{fmtSize(f.size)}</span> : null}
        </button>
      ))}
      {msg && <p className="small bad" role="status">{msg}</p>}
    </div>
  );
}
