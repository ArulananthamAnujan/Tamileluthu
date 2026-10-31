// Verifies a Stripe-Signature header (v1 HMAC-SHA256 over "timestamp.payload").
export async function verifyStripe(payload, header, secret, toleranceSec = 300, now = Date.now()) {
  if (!header || !secret) return false;
  const v1 = [];
  let t = '';
  for (const kv of header.split(',')) {
    const i = kv.indexOf('=');
    if (i < 0) continue;
    const k = kv.slice(0, i).trim(), v = kv.slice(i + 1).trim();
    if (k === 't') t = v; else if (k === 'v1') v1.push(v);
  }
  if (!/^\d+$/.test(t) || !v1.length) return false;
  if (Math.abs(now / 1000 - Number(t)) > toleranceSec) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
  return v1.some((s) => s.length === hex.length && timingSafeEqual(s, hex));
}

function timingSafeEqual(a, b) {
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
