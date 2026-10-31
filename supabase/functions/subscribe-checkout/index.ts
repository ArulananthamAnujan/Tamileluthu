// Starts a monthly Stripe subscription for one student's access to the writing checker.
// A student can pay for themselves; a parent can pay for a linked child.
// Secrets: STRIPE_SECRET_KEY, SITE_URL. Price and currency come from Admin → School details.
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
    // Only the student themself or a linked parent may pay (row level security decides).
    const { data: access, error: accessErr } = await who.db.rpc("my_check_access", { sid: student_id });
    if (accessErr || !access) return json({ error: "You can only subscribe for yourself or your own child." }, 403);
    const db = admin();
    if (who.user.id !== student_id) {
      const { data: link } = await db.from("parent_links").select("student_id").eq("parent_id", who.user.id).eq("student_id", student_id).maybeSingle();
      if (!link) return json({ error: "Only the student or their linked parent can subscribe." }, 403);
    }
    const { data: student } = await db.from("profiles").select("full_name, role").eq("id", student_id).single();
    if (student?.role !== "student") return json({ error: "Subscriptions are for student accounts." }, 400);
    if (!access.required) return json({ error: "The writing checker is free at this school, so no subscription is needed." }, 400);
    if (access.active && access.status !== "manual") return json({ already: true });
    if (!stripeReady()) return json({ error: "Online payment is not set up yet. Please pay the school directly." }, 503);
    const site = siteUrl(req);
    if (!site) return json({ error: "Set the SITE_URL secret for payments." }, 500);

    const [{ data: settings }, { data: existing }] = await Promise.all([
      db.from("school_settings").select("school_name, sub_price_cents, sub_currency").eq("id", 1).single(),
      db.from("subscriptions").select("stripe_customer_id").eq("student_id", student_id).maybeSingle(),
    ]);
    const form: Record<string, string> = {
      mode: "subscription",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": settings.sub_currency,
      "line_items[0][price_data][unit_amount]": String(settings.sub_price_cents),
      "line_items[0][price_data][recurring][interval]": "month",
      "line_items[0][price_data][product_data][name]": `தமிழ் திருத்தி writing checker – ${student.full_name}`.slice(0, 250),
      success_url: `${site}/#/subscription?paid=1`,
      cancel_url: `${site}/#/subscription`,
      client_reference_id: student_id,
      "metadata[student_id]": student_id,
      "metadata[payer_id]": who.user.id,
      "subscription_data[metadata][student_id]": student_id,
      "subscription_data[metadata][payer_id]": who.user.id,
      "subscription_data[description]": `${settings.school_name}: writing checker for ${student.full_name}`.slice(0, 500),
    };
    if (existing?.stripe_customer_id) form.customer = existing.stripe_customer_id;
    else if (who.user.email) form.customer_email = who.user.email;
    const session = await stripe("checkout/sessions", form);
    return json({ url: session.url });
  } catch (_e) {
    return json({ error: "The payment page could not be opened. Please try again." }, 502);
  }
});
