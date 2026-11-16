// Page groups for the booklet reader. Two-up: the cover stands alone, then
// pages sit side by side like an open book (2–3, 4–5 …). One-up: a page each.
export function spreadsFor(pages, two) {
  const out = [];
  if (!two) { for (let n = 1; n <= pages; n++) out.push([n]); return out; }
  if (pages >= 1) out.push([1]);
  for (let n = 2; n <= pages; n += 2) out.push(n + 1 <= pages ? [n, n + 1] : [n]);
  return out;
}
// Which group holds this page (so turning the phone keeps your place).
export function spreadOfPage(spreads, page) {
  const i = spreads.findIndex((s) => s.includes(page));
  return i < 0 ? 0 : i;
}
