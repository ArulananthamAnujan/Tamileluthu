// Opens Stripe's customer portal so a family can cancel or update their card.
// Turn the portal on once in Stripe → Settings → Billing → Customer portal.
import { admin, caller, cors, json, siteUrl, UUID } from "../_shared/http.ts";
import { stripe, stripeReady } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const who = await caller(req);
    if (!who) return json({ error: "Please sign in again." }, 401);
    const { student_id } = await req.json().catch(() => ({}));
    if (typeof student_id !== "string" || !UUID.test(student_id)) return json({ error: "Choose a student." }, 400);
    const { error: accessErr } = await who.db.rpc("my_check_access", { sid: student_id });
    if (accessErr) return json({ error: "Not allowed." }, 403);
    const { data: sub } = await admin().from("subscriptions").select("stripe_customer_id").eq("student_id", student_id).maybeSingle();
    if (!sub?.stripe_customer_id) return json({ error: "There is no card subscription to manage." }, 404);
    if (!stripeReady()) return json({ error: "Online payment is not set up yet." }, 503);
    const session = await stripe("billing_portal/sessions", { customer: sub.stripe_customer_id, return_url: `${siteUrl(req)}/#/subscription` });
    return json({ url: session.url });
  } catch (_e) {
    return json({ error: "The billing page could not be opened. Please try again." }, 502);
  }
});
