import React, { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n.js';
import { SITE } from '../site.js';
import { callFn } from '../lib/scope.js';
import { waLink } from '../lib/wa.js';
import { CATS, GROUPS, catOf, typeLabel, fmtDate } from '../categories.js';
import Icon from './Icon.jsx';
import { createReportPdf, sharePdfFile, savePdfFile } from '../lib/reportPdf.js';
import EssayFeedback, { SECTIONS, grade } from './EssayFeedback.jsx';

function correctedText(text, issues) {
  let out = text || '';
  [...issues].filter((i) => i.start != null && i.correct).sort((a, b) => b.start - a.start)
    .forEach((i) => { out = out.slice(0, i.start) + i.correct + out.slice(i.end); });
  return out;
}

// Plain-text version for WhatsApp and the person's own email app.
export function reportText(sub, name, limit = 3500) {
  const issues = sub.issues || [];
  const e = sub.essay;
  const essayLines = !e ? [] : [
    e.max ? `${t('Practice mark')}: ${e.total}/${e.max} (${Math.round((e.total / e.max) * 100)}%, ${grade(Math.round((e.total / e.max) * 100))})` : '',
    sub.question ? `${t('Question')}: ${sub.question}` : '',
    e.question_feedback || '',
    e.inferred_question ? `→ ${e.inferred_question}` : '',
    ...SECTIONS.flatMap(([k, en, ta]) => {
      const x = e.sections?.[k];
      return x ? [`*${en} · ${ta}*`, ...(x.improvements || []).map((i) => `- ${i}`)] : [];
    }),
    e.overall || '',
  ].filter(Boolean);
  const lines = [
    `${SITE.school} · தமிழ் திருத்தி`,
    `${name || ''}${sub.title ? ` — ${sub.title}` : ''}`,
    ...essayLines,
    '',
    sub.summary || '',
    '',
    `${t('Suggested corrections')} (${issues.length}):`,
    ...issues.map((i, n) => `${n + 1}. ${i.wrong} → ${i.correct || ''}${i.rule ? ` (${i.rule})` : ''}`),
    '',
    `${t('Corrected version')}:`,
    correctedText(sub.original_text, issues),
  ];
  const text = lines.join('\n');
  return text.length > limit ? `${text.slice(0, limit)}…\n(${t('See the PDF for the full report.')})` : text;
}

export default function WritingReport({ sub, studentName, onBack }) {
  const issues = useMemo(() => [...(sub.issues || [])].sort((a, b) => (a.start ?? 1e9) - (b.start ?? 1e9)), [sub.issues]);
  const counts = useMemo(() => { const c = { spell: 0, sandhi: 0, gram: 0, style: 0 }; issues.forEach((i) => c[catOf(i).g]++); return c; }, [issues]);
  const name = studentName || sub.checked_for || '';
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const reportRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfMsg, setPdfMsg] = useState('');

  // Prepare the PDF as soon as the report is on screen, so one tap shares it instantly.
  async function makePdf() {
    if (pdf) return pdf;
    setPdfBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 150));
      const safe = (name || 'student').replace(/[^\w\u0B80-\u0BFF -]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'student';
      const file = await createReportPdf(reportRef.current, `writing-feedback-${safe}.pdf`);
      setPdf(file);
      return file;
    } catch {
      setPdfMsg(t('Could not prepare the PDF. Please use Print / Save as PDF instead.'));
      return null;
    } finally { setPdfBusy(false); }
  }
  useEffect(() => { makePdf(); }, []);

  async function share(whatsapp) {
    setPdfMsg('');
    const file = pdf || await makePdf();
    if (!file) return;
    const res = await sharePdfFile(file, { title: subject, text: whatsapp ? `${subject}` : '', whatsapp });
    if (res === 'retry') setPdfMsg(t('The PDF is ready. Tap the button again to send it.'));
    else if (res === 'downloaded') setPdfMsg(whatsapp
      ? t('PDF saved to your Downloads. In WhatsApp, tap the paperclip (📎) → Document and choose it.')
      : t('PDF saved to your Downloads. Attach it in WhatsApp or email.'));
  }
  async function save() {
    setPdfMsg('');
    const file = pdf || await makePdf();
    if (!file) return;
    const res = await savePdfFile(file);
    setPdfMsg(res === 'ok' ? t('Saved to Downloads.') : res === 'downloaded' ? t('PDF downloaded.') : '');
  }

  const subject = `${t('Writing feedback')} · எழுத்துத் திருத்தம்: ${name}${sub.title ? ` – ${sub.title}` : ''}`;
  const mailBody = `${note ? `${note}\n\n` : ''}${reportText(sub, name, 1600)}`;

  async function send(e) {
    e.preventDefault(); setMsg(''); setBusy(true);
    try {
      const r = await callFn('email-report', { submission_id: sub.id, to, note });
      setMsg(r.sent ? t('Sent to {to}.', { to }) : t('The email could not be sent. Check the address and try again.'));
    } catch (e2) { setMsg(t(e2.message)); }
    setBusy(false);
  }

  return (
    <div className="stack">
      <div className="row between wrap noprint">
        <button className="btn small" onClick={onBack}>← {t('Back')}</button>
        <div className="row wrap">
          <button className="btn primary sharepdf" disabled={pdfBusy && !pdf} onClick={() => share(false)}>
            <Icon name="share" size={17} />{pdf ? t('Share PDF') : t('Preparing PDF…')}
          </button>
          <button className="btn wa" disabled={pdfBusy && !pdf} onClick={() => share(true)}><Icon name="whatsapp" size={17} />{t('WhatsApp PDF')}</button>
          <button className="btn small" disabled={pdfBusy && !pdf} onClick={save}>{t('Save to phone')}</button>
          <button className="btn small ghost" onClick={() => window.print()}>{t('Print')}</button>
        </div>
      </div>

      {pdfMsg && <p className="small noprint" role="status">{pdfMsg}</p>}
      <form className="card form noprint send-report" onSubmit={send}>
        <h3>{t('Send this report by email')}</h3>
        <div className="row wrap">
          <input type="email" multiple required value={to} onChange={(e) => setTo(e.target.value)} placeholder={t('Student or parent email')} className="grow" aria-label={t('Student or parent email')} />
          <button className="btn primary" disabled={busy}>{busy ? t('Sending…') : t('Send from school email')}</button>
        </div>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder={t('Add a note for the student (optional)')} aria-label={t('Note')} />
        {msg && <p className="small" role="status">{msg}</p>}
        <p className="small muted">{t('“Share PDF” sends the report as a PDF file to WhatsApp, email, Drive or any app. “Send from school email” emails the report as a message.')}</p>
      </form>

      <article ref={reportRef} data-pdf-root className="card reportcard printable wreport">
        <header className="rc-head">
          <div>
            <p className="rc-school">{SITE.logoUrl && <img src={SITE.logoUrl} alt="" className="rc-logo" />}{SITE.school}{SITE.schoolTa ? ` · ${SITE.schoolTa}` : ''}</p>
            <h2 className="title">எழுத்துத் திருத்தம் · {t('Writing feedback')}</h2>
          </div>
          <div className="rc-meta small">
            <div><b>{name || t('Student')}</b></div>
            <div>{sub.title || typeLabel(sub.text_type)}</div>
            <div className="muted">{fmtDate(sub.checked_at || sub.created_at)}</div>
          </div>
        </header>
        <section className="chips">
          {Object.entries(GROUPS).map(([g, v]) => <span key={g} className="chip"><span className={`dot d-${g}`} />{t(v.label)} <b>{counts[g]}</b></span>)}
        </section>
        {sub.summary && <section><h3>{t('Feedback')} · கருத்து</h3><p>{sub.summary}</p>
          {issues.length > 0 && sub.focus && CATS[sub.focus] && <p><b>{t('Practise next:')}</b> {CATS[sub.focus].label}</p>}</section>}
        {sub.essay && <EssayFeedback sub={sub} canEdit={false} />}
        <section>
          <h3>{t('Suggested corrections')} · திருத்தங்கள் ({issues.length})</h3>
          {!issues.length ? <p>{t('No definite errors were identified in this check.')} நன்று!</p> : (
            <table className="table wr-table"><tbody>
              {issues.map((i, n) => (
                <tr key={n}>
                  <td className="num muted">{n + 1}</td>
                  <td><span className="fix"><span className="w">{i.wrong}</span>{i.correct && <><span aria-hidden="true">→</span><span className="r">{i.correct}</span></>}</span>
                    {i.rule && <div className="small">{i.rule}</div>}
                    <div className="small muted">{catOf(i).label}</div></td>
                </tr>
              ))}
            </tbody></table>
          )}
        </section>
        <section>
          <h3>{t('Corrected version')} · திருத்திய வடிவம்</h3>
          <div className="doc fixed wr-doc">{correctedText(sub.original_text, issues)}</div>
        </section>
        {sub.handwriting?.length > 0 && <section><h3>{t('Handwriting notes')}</h3><ul>{sub.handwriting.map((h, n) => <li key={n}>{h}</li>)}</ul></section>}
        <footer className="rc-foot small muted">
          <span>{t('AI-assisted practice feedback, not an exam mark.')}</span>
          <span>தமிழ் திருத்தி</span>
        </footer>
      </article>
    </div>
  );
}
