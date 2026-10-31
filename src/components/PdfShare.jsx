import React, { useEffect, useState } from 'react';
import { t } from '../i18n.js';
import { createReportPdf, sharePdfFile, savePdfFile } from '../lib/reportPdf.js';
import Icon from './Icon.jsx';

// "Share PDF" + "WhatsApp PDF" + "Save to phone" for any on-screen report (prepared in advance).
export default function PdfShare({ targetRef, filename, title }) {
  const [pdf, setPdf] = useState(null);
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState('');
  async function make() {
    if (pdf) return pdf;
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 300));
      const f = await createReportPdf(targetRef.current, filename);
      setPdf(f); return f;
    } catch (err) { console.error('PDF failed:', err); setMsg(t('Could not prepare the PDF. Please use Print / Save as PDF instead.')); return null; }
    finally { setBusy(false); }
  }
  useEffect(() => { make(); }, []);
  async function share(whatsapp) {
    setMsg('');
    const f = pdf || await make(); if (!f) return;
    const res = await sharePdfFile(f, { title, text: whatsapp ? title : '', whatsapp });
    if (res === 'update_app') setMsg(t('This copy of the app is too old to share files. Install the latest app (GitHub → Actions → Build Android app → TamilThiruthi-APK), or open the website in Chrome.'));
    else if (String(res).startsWith('app_error')) setMsg(t('The app could not share the PDF ({code}). Please try again.', { code: String(res).slice(10) }));
    else if (res === 'shared') setMsg(t('Choose WhatsApp, email or another app to send the PDF.'));
    else if (res === 'retry') setMsg(t('The PDF is ready. Tap the button again to send it.'));
    else if (res === 'downloaded') setMsg(whatsapp ? t('PDF saved to your Downloads. In WhatsApp, tap the paperclip (📎) → Document and choose it.') : t('PDF saved to your Downloads. Attach it in WhatsApp or email.'));
  }
  async function save() {
    setMsg('');
    const f = pdf || await make(); if (!f) return;
    const res = await savePdfFile(f);
    setMsg(res === 'ok' ? t('Saved to Downloads.') : res === 'downloaded' ? t('PDF downloaded.') : res === 'update_app' ? t('This copy of the app is too old to save files. Install the latest app, or open the website in Chrome.') : res === 'shared' ? '' : t('Could not save the PDF. Please try Share PDF instead.'));
  }
  return (
    <>
      <button className="btn primary sharepdf" disabled={false} onClick={() => share(false)}><Icon name="share" size={17} />{pdf ? t('Share PDF') : t('Preparing PDF…')}</button>
      <button className="btn wa" disabled={false} onClick={() => share(true)}><Icon name="whatsapp" size={17} />{t('WhatsApp PDF')}</button>
      <button className="btn small" disabled={false} onClick={save}>{t('Save to phone')}</button>
      <button className="btn small ghost" onClick={() => window.print()}>{t('Print')}</button>
      {msg && <p className="small pdfmsg" role="status">{msg}</p>}
    </>
  );
}
