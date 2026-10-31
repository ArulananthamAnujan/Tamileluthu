// Paper shop — starts a Stripe Checkout payment for one item.
// Secrets: STRIPE_SECRET_KEY (sk_live_… or sk_test_…), optional SITE_URL.
// The purchase becomes "paid" only when stripe-webhook receives Stripe's signed event.
import { admin, caller, cors, json, siteUrl, UUID } from "../_shared/http.ts";

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const who = await caller(req);
    if (!who) return json({ error: "Please sign in to buy." }, 401);
    if (!STRIPE_KEY) return json({ error: "Online payment is not set up yet. Please contact the school." }, 503);
    const { product_id } = await req.json().catch(() => ({}));
    if (typeof product_id !== "string" || !UUID.test(product_id)) return json({ error: "Unknown item." }, 400);

    const db = admin();
    const { data: p } = await db.from("products")
      .select("id, title, description, price_cents, currency, active, seller_id").eq("id", product_id).maybeSingle();
    if (!p || !p.active) return json({ error: "This item is no longer available." }, 404);
    if (p.price_cents <= 0) return json({ error: "This item is free." }, 400);
    const { data: owned } = await db.from("purchases").select("id")
      .eq("product_id", p.id).eq("buyer_id", who.user.id).eq("status", "paid").maybeSingle();
    if (owned) return json({ already: true });

    const site = siteUrl(req);
    if (!site) return json({ error: "Set the SITE_URL secret for the shop." }, 500);
    const form = new URLSearchParams({
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": p.currency,
      "line_items[0][price_data][unit_amount]": String(p.price_cents),
      "line_items[0][price_data][product_data][name]": p.title.slice(0, 250),
      success_url: `${site}/#/shop?paid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/#/shop`,
      client_reference_id: who.user.id,
      "metadata[product_id]": p.id,
      "metadata[buyer_id]": who.user.id,
      ...(who.user.email ? { customer_email: who.user.email } : {}),
    });
    if (p.description) form.set("line_items[0][price_data][product_data][description]", p.description.slice(0, 500));
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${STRIPE_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const session = await res.json();
    if (!res.ok || !session.url) return json({ error: "The payment page could not be opened. Please try again." }, 502);
    await db.from("purchases").insert({
      product_id: p.id, buyer_id: who.user.id, status: "pending", amount_cents: p.price_cents,
      currency: p.currency, method: "stripe", stripe_session_id: session.id,
    });
    return json({ url: session.url });
  } catch (_e) {
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
