import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyStripe } from '../supabase/functions/stripe-webhook/sign.mjs';
import { esc, reportEmail, marksEmail, noticeEmail } from '../supabase/functions/_shared/emails.mjs';

const secret = 'whsec_test';
const sign = (payload, t) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')}`;

test('accepts a valid, fresh Stripe signature', async () => {
  const now = Date.now(); const t = Math.floor(now / 1000);
  assert.equal(await verifyStripe('{"a":1}', sign('{"a":1}', t), secret, 300, now), true);
});
test('rejects tampered, stale, unsigned and wrong-secret events', async () => {
  const now = Date.now(); const t = Math.floor(now / 1000);
  assert.equal(await verifyStripe('{"a":2}', sign('{"a":1}', t), secret, 300, now), false);
  assert.equal(await verifyStripe('{"a":1}', sign('{"a":1}', t - 1000), secret, 300, now), false);
  assert.equal(await verifyStripe('{"a":1}', null, secret, 300, now), false);
  assert.equal(await verifyStripe('{"a":1}', sign('{"a":1}', t), 'other', 300, now), false);
  assert.equal(await verifyStripe('{"a":1}', sign('{"a":1}', t), '', 300, now), false);
});
test('parent emails escape teacher and student text', () => {
  const ctx = { school: 'S<b>', site: 'https://x.org', className: 'C', teacher: 'T' };
  assert.equal(esc('<script>"&\''), '&lt;script&gt;&quot;&amp;&#39;');
  const r = reportEmail(ctx, '<img>', { term: 'T4', comment: '<script>x</script>' });
  assert.ok(!r.html.includes('<script>') && !r.html.includes('<img>') && r.html.includes('/#/reports'));
  const m = marksEmail(ctx, 'Arun', { title: 'Test', max_mark: 20 }, { mark: 17, absent: false, comment: null });
  assert.ok(m.html.includes('17 / 20 (85%)'));
  assert.ok(marksEmail(ctx, 'Arun', { title: 'T', max_mark: 20 }, { mark: null, absent: true }).html.includes('Absent'));
  const n = noticeEmail(ctx, { title: 'Hi', body: 'a<b', link_url: 'https://e.org/?a="b"' });
  assert.ok(n.html.includes('a&lt;b') && !n.html.includes('"b"'));
});

import { inviteEmail, writingReportEmail } from '../supabase/functions/_shared/emails.mjs';
test('invite and writing-report emails are escaped and complete', () => {
  const inv = inviteEmail({ school: 'S', site: 'https://x.org', className: '<b>Y6</b>', teacher: 'T', code: 'AB12CD' }, '<script>');
  assert.ok(inv.html.includes('https://x.org/#/join?code=AB12CD') && inv.html.includes('AB12CD'));
  assert.ok(!inv.html.includes('<script>') && !inv.html.includes('<b>Y6</b>'));
  const text = 'நான் பள்ளிக்கு போனேன்'; const w = 'பள்ளிக்கு'; const start = text.indexOf(w);
  const sub = { checked_for: 'Arun', title: 'Letter', summary: 'Good', original_text: text,
    issues: [{ wrong: w, correct: 'பள்ளிக்குப்', start, end: start + w.length, rule: 'Double after -க்கு' }] };
  const r = writingReportEmail({ school: 'S', teacher: 'T' }, sub, '');
  assert.ok(r.subject.includes('Arun') && r.html.includes('நான் பள்ளிக்குப் போனேன்'));
});

import { essayHtml } from '../supabase/functions/_shared/emails.mjs';
test('essay assessment appears in emails, escaped', () => {
  const h = essayHtml({ question: '<q>', essay: { question_status: 'partly_answered', question_feedback: 'Covers <b>one</b> part', inferred_question: '',
    total: 18, max: 25, rubric: [{ criterion: 'structure', score: 4 }],
    sections: { introduction: { present: true, what_you_wrote: 'x', improvements: ['Add a hook'], example: 'அன்புள்ள நண்பா' }, body: { present: false, improvements: [] }, conclusion: null }, overall: 'Good' } });
  assert.ok(h.includes('18/25') && h.includes('72%') && h.includes('Partly answers') && h.includes('Add a hook') && h.includes('(missing)'));
  assert.ok(!h.includes('<q>') && !h.includes('<b>one</b>'));
  assert.equal(essayHtml({ essay: null }), '');
});
