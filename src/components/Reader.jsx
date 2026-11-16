import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabase.js';
import { t } from '../i18n.js';
import { fileExt } from '../lib/media.js';
import { spreadsFor, spreadOfPage } from '../lib/booklet.js';

const KIND = { pdf: 'pdf', jpg: 'image', jpeg: 'image', png: 'image', mp3: 'audio', m4a: 'audio' };
export const canRead = (name) => Boolean(KIND[fileExt(name)]);

// The PDF engine is large, so it is fetched only when someone opens a PDF.
let engine;
function loadPdfEngine() {
  engine ||= Promise.all([
    import('pdfjs-dist/legacy/build/pdf.min.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]).then(([lib, worker]) => { lib.GlobalWorkerOptions.workerSrc = worker.default; return lib; });
  return engine;
}
const recall = (k) => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } };
const remember = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* private mode */ } };

// One page drawn to fit inside a box.
function Page({ pdf, n, maxW, maxH, zoom }) {
  const ref = useRef(null);
  const [size, setSize] = useState(null);
  useEffect(() => {
    let off = false; let task;
    pdf.getPage(n).then((page) => {
      if (off) return;
      const base = page.getViewport({ scale: 1 });
      const fit = Math.min(maxW / base.width, maxH / base.height) * zoom;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const view = page.getViewport({ scale: fit * dpr });
      const c = ref.current; if (!c) return;
      c.width = Math.floor(view.width); c.height = Math.floor(view.height);
      setSize({ w: Math.floor(base.width * fit), h: Math.floor(base.height * fit) });
      task = page.render({ canvasContext: c.getContext('2d'), viewport: view, canvas: c });
      task.promise.catch(() => { /* cancelled when the page is turned */ });
    });
    return () => { off = true; task?.cancel(); };
  }, [pdf, n, Math.round(maxW), Math.round(maxH), zoom]);
  return <canvas ref={ref} className="rd-page" style={size ? { width: size.w, height: size.h } : { width: maxW * 0.7, height: maxH }} aria-label={t('Page {n}', { n })} />;
}

function Booklet({ url, storeKey }) {
  const stage = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [fail, setFail] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [dir, setDir] = useState('next');
  const swipe = useRef(null);

  useEffect(() => {
    let off = false; let task;
    loadPdfEngine().then((lib) => { task = lib.getDocument({ url }); return task.promise; }).then((d) => {
      if (off) return;
      setPdf(d); setPage(Math.min(Math.max(1, recall(storeKey)), d.numPages));
    }).catch(() => { if (!off) setFail(true); });
    // Closing the reader stops the download and frees the pages.
    return () => { off = true; try { task?.destroy(); } catch { /* already closed */ } };
  }, [url]);
  useLayoutEffect(() => {
    const el = stage.current; if (!el) return undefined;
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const two = box.w >= 820 && box.w > box.h; // an open book on wide screens, one page on phones
  const spreads = pdf ? spreadsFor(pdf.numPages, two) : [];
  const at = pdf ? spreadOfPage(spreads, page) : 0;
  const cur = spreads[at] || [];
  const go = (i) => {
    if (i < 0 || i >= spreads.length) return;
    setDir(i > at ? 'next' : 'prev'); setPage(spreads[i][0]); remember(storeKey, spreads[i][0]);
    stage.current?.scrollTo?.(0, 0);
  };
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(at + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(at - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (fail) return <p className="rd-note">{t('This file could not be shown here. Use Download to open it.')}</p>;
  const pad = two ? 48 : 16;
  const maxW = Math.max(120, (box.w - pad) / (two ? 2 : 1));
  const maxH = Math.max(160, box.h - 16);
  return (
    <>
      <div className="rd-stage" ref={stage}
        onTouchStart={(e) => { swipe.current = zoom === 1 ? e.touches[0].clientX : null; }}
        onTouchEnd={(e) => {
          if (swipe.current == null) return;
          const dx = e.changedTouches[0].clientX - swipe.current; swipe.current = null;
          if (Math.abs(dx) > 50) go(at + (dx < 0 ? 1 : -1));
        }}>
        {!pdf ? <p className="rd-note">{t('Opening…')}</p> : (
          <div key={at} className={`rd-spread ${two ? 'two' : 'one'} turn-${dir}`}>
            {cur.map((n) => <Page key={n} pdf={pdf} n={n} maxW={maxW} maxH={maxH} zoom={zoom} />)}
          </div>
        )}
        {pdf && zoom === 1 && <>
          <button type="button" className="rd-edge left" onClick={() => go(at - 1)} disabled={at === 0} aria-label={t('Previous page')} />
          <button type="button" className="rd-edge right" onClick={() => go(at + 1)} disabled={at >= spreads.length - 1} aria-label={t('Next page')} />
        </>}
      </div>
      {pdf && (
        <div className="rd-bar">
          <button type="button" className="rd-btn" onClick={() => go(at - 1)} disabled={at === 0} aria-label={t('Previous page')}>‹</button>
          <input type="range" min={0} max={Math.max(0, spreads.length - 1)} value={at} onChange={(e) => go(Number(e.target.value))} aria-label={t('Go to page')} disabled={spreads.length < 2} />
          <span className="rd-count" role="status">{cur.length > 1 ? `${cur[0]}–${cur[1]}` : cur[0]} / {pdf.numPages}</span>
          <button type="button" className="rd-btn" onClick={() => go(at + 1)} disabled={at >= spreads.length - 1} aria-label={t('Next page')}>›</button>
          <span className="rd-zoom">
            <button type="button" className="rd-btn" onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))} disabled={zoom <= 1} aria-label={t('Smaller')}>−</button>
            <button type="button" className="rd-btn" onClick={() => setZoom((z) => Math.min(3, +(z + 0.5).toFixed(1)))} disabled={zoom >= 3} aria-label={t('Larger')}>+</button>
          </span>
        </div>
      )}
    </>
  );
}

// Opens a stored file on top of the page: PDFs as a booklet, pictures and audio
// directly. Other kinds (Word, PowerPoint, Excel) can only be downloaded.
export default function Reader({ bucket, path, name, title, onClose }) {
  const kind = KIND[fileExt(name)] || 'other';
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState('');
  const root = useRef(null);

  useEffect(() => {
    let off = false;
    supabase.storage.from(bucket).createSignedUrl(path, 3600).then(({ data, error }) => {
      if (off) return;
      if (error || !data?.signedUrl) setErr(t('This file could not be opened. Ask your teacher to share it again.')); else setUrl(data.signedUrl);
    });
    return () => { off = true; };
  }, [bucket, path]);
  // The phone's Back button closes the reader instead of leaving the page.
  useEffect(() => {
    window.history.pushState({ reader: true }, '');
    const onPop = () => onClose();
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('popstate', onPop); window.addEventListener('keydown', onKey);
    const was = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('keydown', onKey); document.body.style.overflow = was; };
  }, []);
  function close() { if (window.history.state?.reader) window.history.back(); else onClose(); }
  async function download() {
    const safe = (name || '').replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 120) || true;
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 300, { download: safe });
    if (data?.signedUrl) window.location.href = data.signedUrl;
  }
  const full = () => (document.fullscreenElement ? document.exitFullscreen() : root.current?.requestFullscreen?.())?.catch?.(() => {});
  const stop = (e) => e.stopPropagation(); // keep the app's pull-to-refresh out of the reader

  return createPortal(
    <div className="reader" ref={root} role="dialog" aria-modal="true" aria-label={title || name} onTouchStart={stop} onTouchMove={stop} onTouchEnd={stop}>
      <div className="rd-top">
        <b className="rd-title">{title || name}</b>
        <button type="button" className="rd-btn text" onClick={download}>{t('Download')}</button>
        {kind === 'pdf' && document.fullscreenEnabled && <button type="button" className="rd-btn" onClick={full} aria-label={t('Full screen')}>⛶</button>}
        <button type="button" className="rd-btn" onClick={close} aria-label={t('Close')}>✕</button>
      </div>
      {err ? <p className="rd-note">{err}</p>
        : kind === 'other' ? <div className="rd-note"><p>{t('This kind of file cannot be shown on the page. Download it to open it.')}</p><button type="button" className="btn primary" onClick={download}>{t('Download')}</button></div>
        : !url ? <p className="rd-note">{t('Opening…')}</p>
        : kind === 'pdf' ? <Booklet url={url} storeKey={`tt-read-${path}`} />
        : kind === 'image' ? <div className="rd-stage"><img className="rd-img" src={url} alt={title || name} /></div>
        : <div className="rd-note"><audio controls autoPlay src={url} /></div>}
    </div>, document.body);
}
