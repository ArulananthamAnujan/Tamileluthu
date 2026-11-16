import React, { useState } from 'react';
import { t } from '../i18n.js';
import Reader from './Reader.jsx';
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

// Files attached to a diary post. PDFs open as a booklet on the page.
export function Files({ files }) {
  const [open, setOpen] = useState(null);
  if (!files?.length) return null;
  return (
    <div className="files">
      {files.map((f) => (
        <button key={f.path} type="button" className="file" onClick={() => setOpen(f)}>
          <span className="file-ext" aria-hidden="true">{fileExt(f.name) || fileExt(f.path)}</span>
          <span className="file-name">{f.name}</span>
          {f.size ? <span className="small muted">{fmtSize(f.size)}</span> : null}
        </button>
      ))}
      {open && <Reader bucket="homework" path={open.path} name={open.name} onClose={() => setOpen(null)} />}
    </div>
  );
}
