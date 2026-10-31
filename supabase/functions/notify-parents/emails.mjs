// Email bodies for parents. Plain, short, and every value is HTML-escaped.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const wrap = (ctx, body, link) => `<!doctype html><html><body style="font-family:Arial,'Noto Sans Tamil',sans-serif;color:#16232A;line-height:1.5;max-width:560px;margin:0 auto;padding:16px">
<p style="font-size:18px;font-weight:bold;color:#0E5E63;margin:0 0 12px">${esc(ctx.school)}</p>
${body}
${ctx.site ? `<p style="margin:20px 0"><a href="${esc(ctx.site + link)}" style="background:#0E5E63;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open the parent portal · பெற்றோர் பகுதியைத் திற</a></p>` : ''}
<p style="color:#5B6B70;font-size:12px">${esc(ctx.teacher)} · ${esc(ctx.className)}<br>You receive this because your account is linked to a student in this class.<br>இந்த வகுப்பிலுள்ள மாணவருடன் உங்கள் கணக்கு இணைந்திருப்பதால் இது அனுப்பப்படுகிறது.</p>
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
