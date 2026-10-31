import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyStripe } from '../supabase/functions/stripe-webhook/sign.mjs';
import { esc, reportEmail, marksEmail, noticeEmail } from '../supabase/functions/notify-parents/emails.mjs';

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
