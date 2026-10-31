// Email bodies for parents. Plain, short, and every value is HTML-escaped.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const wrap = (ctx, body, link) => `<!doctype html><html><body style="font-family:Arial,'Noto Sans Tamil',sans-serif;color:#16232A;line-height:1.5;max-width:560px;margin:0 auto;padding:16px">
<p style="font-size:18px;font-weight:bold;color:#0E5E63;margin:0 0 12px">${esc(ctx.school)}</p>
${body}
${ctx.site ? `<p style="margin:20px 0"><a href="${esc(ctx.site + link)}" style="background:#0E5E63;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open the parent portal · பெற்றோர் பகுதியைத் திற</a></p>` : ''}
<p style="color:#5B6B70;font-size:12px">${esc(ctx.teacher)} · ${esc(ctx.className)}<br>${ctx.footer ?? 'You receive this because your account is linked to a student in this class.<br>இந்த வகுப்பிலுள்ள மாணவருடன் உங்கள் கணக்கு இணைந்திருப்பதால் இது அனுப்பப்படுகிறது.'}</p>
</body></html>`;

export function reportEmail(ctx, child, r) {
  return {
    subject: `${child}'s report – ${r.term}`,
    html: wrap(ctx, `<p>Dear parent, / அன்புள்ள பெற்றோரே,</p><p><b>${esc(child)}</b>'s report for <b>${esc(r.term)}</b> is ready.<br>${esc(child)} அவர்களின் ${esc(r.term)} தேர்ச்சி அறிக்கை தயார்.</p>
${r.comment ? `<p style="border-left:3px solid #0E5E63;padding-left:10px">${esc(r.comment)}</p>` : ''}
<p>Sign in to see the full report, attendance and marks, and to print or save it as a PDF.<br>முழு அறிக்கையைப் பார்க்கவும் அச்சிடவும் உள்நுழையுங்கள்.</p>`, '/#/reports'),
  };
}

export function marksEmail(ctx, child, a, m) {
  const result = !m ? 'No mark recorded.' : m.absent ? 'Absent' : m.mark == null ? 'No mark recorded.'
    : `${Number(m.mark)} / ${Number(a.max_mark)} (${Math.round((Number(m.mark) / Number(a.max_mark)) * 100)}%)`;
  return {
    subject: `${child}: ${a.title} result`,
    html: wrap(ctx, `<p>Dear parent, / அன்புள்ள பெற்றோரே,</p><p>The result for <b>${esc(a.title)}</b> is now available.<br>${esc(a.title)} — முடிவு வெளியாகியுள்ளது.</p>
<p style="font-size:20px;margin:8px 0"><b>${esc(child)}</b>: ${esc(result)}</p>
${m?.comment ? `<p>Teacher's comment / ஆசிரியர் கருத்து: ${esc(m.comment)}</p>` : ''}`, '/#/marks'),
  };
}

export function noticeEmail(ctx, a) {
  return {
    subject: `${ctx.className}: ${a.title}`,
    html: wrap(ctx, `<p>Dear parent, / அன்புள்ள பெற்றோரே,</p><p style="font-size:17px"><b>${esc(a.title)}</b></p>
${a.body ? `<p style="white-space:pre-wrap">${esc(a.body)}</p>` : ''}
${a.due_on ? `<p>Date / திகதி: ${esc(a.due_on)}</p>` : ''}
${a.link_url ? `<p><a href="${esc(a.link_url)}">${esc(a.link_url)}</a></p>` : ''}`, '/#/today'),
  };
}

// Invitation to join a class. The link opens the sign-up page with the class code filled in.
export function inviteEmail(ctx, note) {
  const link = `${ctx.site}/#/join?code=${encodeURIComponent(ctx.code)}`;
  return {
    subject: `Join ${ctx.className} at ${ctx.school} · வகுப்பில் சேர அழைப்பு`,
    html: wrap({ ...ctx, site: '', footer: 'You received this invitation from your Tamil school teacher. If it is not for you, you can ignore it.' }, `<p>Hello! / வணக்கம்!</p>
<p><b>${esc(ctx.teacher)}</b> has invited you to join <b>${esc(ctx.className)}</b> on our school app, for homework, listening exams, marks and the தமிழ் திருத்தி writing checker.<br>
${esc(ctx.teacher)} உங்களை <b>${esc(ctx.className)}</b> வகுப்பில் சேர அழைக்கிறார்.</p>
${note ? `<p style="border-left:3px solid #0E5E63;padding-left:10px;white-space:pre-wrap">${esc(note)}</p>` : ''}
<p style="margin:20px 0"><a href="${esc(link)}" style="background:#C9962B;color:#2B1D03;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Join the class · வகுப்பில் சேர்</a></p>
<p>Or create a <b>Student</b> account at <a href="${esc(ctx.site)}">${esc(ctx.site)}</a> and enter the class code:<br>
<span style="font-size:24px;letter-spacing:4px;font-weight:bold;color:#C9962B">${esc(ctx.code)}</span></p>
<p style="color:#5B6B70;font-size:13px">Parents: after your child joins, open their account to find the parent code and link your own Parent account.</p>`, ''),
  };
}

const SECTION_NAMES = [['introduction', 'Introduction · முன்னுரை'], ['body', 'Body · பொருளுரை'], ['conclusion', 'Conclusion · முடிவுரை']];
const CRITERIA_NAMES = { relevance: 'Answering the question', structure: 'Structure', accuracy: 'Language accuracy', vocabulary: 'Vocabulary & expression', conventions: 'Text type & register' };
const QSTATUS = { answered: 'Answers the question ✓', partly_answered: 'Partly answers the question', not_answered: 'Does not answer the question', no_question: 'Question not given' };

// The examiner's assessment (question check, sections, practice mark) for emails.
export function essayHtml(sub) {
  const e = sub.essay;
  if (!e) return '';
  const pct = e.max ? Math.round((e.total / e.max) * 100) : null;
  const sec = SECTION_NAMES.map(([k, label]) => {
    const x = e.sections?.[k];
    if (!x) return '';
    return `<p style="margin:12px 0 4px"><b>${esc(label)}</b>${x.present ? '' : ' (missing)'}</p>
${x.what_you_wrote ? `<p style="margin:0;color:#5B6B70;font-size:14px">${esc(x.what_you_wrote)}</p>` : ''}
${(x.improvements || []).length ? `<ul style="margin:4px 0">${x.improvements.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
${x.example ? `<p style="margin:4px 0;background:#F2F8F3;padding:8px;border-radius:6px">${esc(x.example)}</p>` : ''}`;
  }).join('');
  const rub = (e.rubric || []).map((r) => `<tr><td style="padding:4px 8px 4px 0">${esc(CRITERIA_NAMES[r.criterion] || r.criterion)}</td><td style="padding:4px 0"><b>${Number(r.score)}/5</b></td></tr>`).join('');
  return `<div style="border:1px solid #E7E0D2;border-radius:10px;padding:14px;margin:12px 0">
${pct != null ? `<p style="font-size:20px;margin:0 0 6px"><b>${Number(e.total)}/${Number(e.max)}</b> (${pct}%) <span style="font-size:13px;color:#5B6B70">practice mark</span></p>` : ''}
<p style="margin:0 0 6px"><b>${esc(QSTATUS[e.question_status] || '')}</b></p>
${sub.question ? `<p style="margin:0 0 6px;font-size:14px">Question: ${esc(sub.question)}</p>` : ''}
${e.question_feedback ? `<p style="margin:0 0 6px">${esc(e.question_feedback)}</p>` : ''}
${e.inferred_question ? `<p style="margin:0 0 6px"><b>${esc(e.inferred_question)}</b></p>` : ''}
${rub ? `<table style="border-collapse:collapse;font-size:14px;margin:6px 0">${rub}</table>` : ''}
${sec}
${e.overall ? `<p style="margin-top:12px">${esc(e.overall)}</p>` : ''}
</div>`;
}

function corrected(text, issues) {
  let t = text || '';
  [...(issues || [])].filter((i) => i.start != null && i.correct).sort((a, b) => b.start - a.start)
    .forEach((i) => { t = t.slice(0, i.start) + i.correct + t.slice(i.end); });
  return t;
}

// Writing feedback a teacher forwards to a student or parent.
export function writingReportEmail(ctx, sub, note) {
  const name = sub.checked_for || ctx.student || 'Student';
  const issues = (sub.issues || []).slice(0, 40);
  const rows = issues.map((i, n) => `<tr><td style="padding:6px;border-bottom:1px solid #E7E0D2;color:#5B6B70">${n + 1}</td>
<td style="padding:6px;border-bottom:1px solid #E7E0D2"><s style="color:#C2362B">${esc(i.wrong)}</s> → <b style="color:#2C7A3F">${esc(i.correct || '')}</b><br><span style="font-size:13px">${esc(i.rule || '')}</span></td></tr>`).join('');
  return {
    subject: `Writing feedback · எழுத்துத் திருத்தம்: ${name}${sub.title ? ` – ${sub.title}` : ''}`,
    html: wrap({ ...ctx, site: '', footer: 'Sent by your Tamil teacher.' }, `<p><b>${esc(name)}</b>${sub.title ? ` · ${esc(sub.title)}` : ''}</p>
${note ? `<p style="border-left:3px solid #0E5E63;padding-left:10px;white-space:pre-wrap">${esc(note)}</p>` : ''}
${essayHtml(sub)}
${sub.summary ? `<p>${esc(sub.summary)}</p>` : ''}
<p><b>${issues.length} suggested correction${issues.length === 1 ? '' : 's'} · திருத்தங்கள்</b></p>
${issues.length ? `<table style="border-collapse:collapse;width:100%;font-size:15px">${rows}</table>` : '<p>No definite errors were found. நன்று!</p>'}
<p style="margin-top:18px"><b>Corrected version · திருத்திய வடிவம்</b></p>
<p style="white-space:pre-wrap;background:#F2F8F3;padding:12px;border-radius:8px;font-size:16px;line-height:1.8">${esc(corrected(sub.original_text, issues))}</p>
<p style="color:#5B6B70;font-size:12px">AI-assisted practice feedback checked with தமிழ் திருத்தி, not an exam mark.</p>`, ''),
  };
}
