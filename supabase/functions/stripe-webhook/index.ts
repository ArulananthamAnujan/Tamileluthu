// Paper shop — receives Stripe's signed payment events and marks purchases paid.
// Deploy WITHOUT JWT checking (Stripe cannot sign in):
//   supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: STRIPE_WEBHOOK_SECRET (whsec_… from Stripe → Developers → Webhooks).
import { admin } from "../_shared/http.ts";
import { verifyStripe } from "./sign.mjs";

const SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const payload = await req.text();
  if (!(await verifyStripe(payload, req.headers.get("Stripe-Signature"), SECRET))) {
    return new Response("Bad signature", { status: 400 });
  }
  const event = JSON.parse(payload);
  const s = event?.data?.object;
  const db = admin();
  if ((event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded")
      && s?.payment_status === "paid") {
    const { data: row } = await db.from("purchases").select("id, product_id, buyer_id, amount_cents, currency")
      .eq("stripe_session_id", s.id).maybeSingle();
    // Only trust the session we created, and only if Stripe charged the expected amount.
    if (row && s.metadata?.product_id === row.product_id && s.metadata?.buyer_id === row.buyer_id
        && Number(s.amount_total) === row.amount_cents && String(s.currency) === row.currency) {
      const { error } = await db.from("purchases").update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", row.id).neq("status", "paid");
      // A second paid row for the same buyer/item is blocked by a unique index; that is fine.
      if (error && !/duplicate key/i.test(error.message)) return new Response("Retry", { status: 500 });
    }
  } else if (event.type === "charge.refunded" && s?.payment_intent) {
    const { data: sessions } = await fetchSessions(String(s.payment_intent));
    for (const id of sessions) await db.from("purchases").update({ status: "refunded" }).eq("stripe_session_id", id);
  }
  return new Response("ok");
});

async function fetchSessions(paymentIntent: string): Promise<{ data: string[] }> {
  const key = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!key) return { data: [] };
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions?payment_intent=${encodeURIComponent(paymentIntent)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return { data: [] };
  const body = await res.json();
  return { data: (body.data || []).map((x: { id: string }) => x.id) };
}
