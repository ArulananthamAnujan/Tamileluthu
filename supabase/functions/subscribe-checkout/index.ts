// Starts (or changes) a monthly Stripe subscription for one student's access to
// the writing checker. A student can pay for themselves; a parent can pay for a
// linked child. The family picks a plan (Admin → Subscriptions sets the plans).
// Secrets: STRIPE_SECRET_KEY, SITE_URL.
import { admin, caller, cors, json, siteUrl, UUID } from "../_shared/http.ts";
import { stripe, stripeReady, syncSubscription } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const who = await caller(req);
    if (!who) return json({ error: "Please sign in again." }, 401);
    const { student_id, plan_id } = await req.json().catch(() => ({}));
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

    // The chosen plan (older app versions send none: use the smallest plan).
    let planQuery = db.from("sub_plans").select("id, name, checks_per_month, price_cents").eq("active", true);
    planQuery = typeof plan_id === "string" && plan_id
      ? planQuery.eq("id", plan_id)
      : planQuery.order("sort").order("price_cents").limit(1);
    const { data: plans } = await planQuery;
    const plan = plans?.[0];
    if (!plan) return json({ error: "That plan is not available. Please choose another." }, 400);

    const card = access.active && access.status !== "manual";
    if (card && access.plan_id === plan.id) return json({ already: true });
    if (!stripeReady()) return json({ error: "Online payment is not set up yet. Please pay the school directly." }, 503);

    const [{ data: settings }, { data: existing }] = await Promise.all([
      db.from("school_settings").select("school_name, sub_currency").eq("id", 1).single(),
      db.from("subscriptions").select("stripe_customer_id, stripe_subscription_id").eq("student_id", student_id).maybeSingle(),
    ]);
    const meta = { plan_id: plan.id, checks_per_month: String(plan.checks_per_month) };

    // Already paying by card: switch the plan now. Stripe charges (or credits) the
    // difference for the rest of this month to the card on file.
    if (card) {
      if (access.status === "past_due") return json({ error: "The last payment did not go through. Update the card first (Manage), then change plan." }, 400);
      if (!existing?.stripe_subscription_id) return json({ error: "The card subscription could not be found. Please contact the school." }, 404);
      const sub = await stripe(`subscriptions/${encodeURIComponent(existing.stripe_subscription_id)}`);
      const item = sub.items?.data?.[0];
      const product = typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id;
      if (!item?.id || !product) return json({ error: "The card subscription could not be changed. Please contact the school." }, 500);
      try {
        await stripe(`subscriptions/${encodeURIComponent(sub.id)}`, {
          "items[0][id]": item.id,
          "items[0][price_data][currency]": settings.sub_currency,
          "items[0][price_data][product]": product,
          "items[0][price_data][unit_amount]": String(plan.price_cents),
          "items[0][price_data][recurring][interval]": "month",
          proration_behavior: "always_invoice",
          payment_behavior: "error_if_incomplete",
          "metadata[plan_id]": meta.plan_id,
          "metadata[checks_per_month]": meta.checks_per_month,
        });
      } catch (e) {
        return json({ error: `The plan could not be changed: ${(e as Error).message}` }, 402);
      }
      await syncSubscription(db, sub.id);
      return json({ changed: true, plan: plan.name });
    }

    const site = siteUrl(req);
    if (!site) return json({ error: "Set the SITE_URL secret for payments." }, 500);
    const form: Record<string, string> = {
      mode: "subscription",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": settings.sub_currency,
      "line_items[0][price_data][unit_amount]": String(plan.price_cents),
      "line_items[0][price_data][recurring][interval]": "month",
      "line_items[0][price_data][product_data][name]": `தமிழ் திருத்தி writing checker – ${student.full_name}`.slice(0, 250),
      success_url: `${site}/#/subscription?paid=1`,
      cancel_url: `${site}/#/subscription`,
      client_reference_id: student_id,
      "metadata[student_id]": student_id,
      "metadata[payer_id]": who.user.id,
      "metadata[plan_id]": meta.plan_id,
      "subscription_data[metadata][student_id]": student_id,
      "subscription_data[metadata][payer_id]": who.user.id,
      "subscription_data[metadata][plan_id]": meta.plan_id,
      "subscription_data[metadata][checks_per_month]": meta.checks_per_month,
      "subscription_data[description]": `${settings.school_name || "Tamil Eluthu"}: ${plan.name} plan (${plan.checks_per_month} checks a month) for ${student.full_name}`.slice(0, 500),
    };
    if (existing?.stripe_customer_id) form.customer = existing.stripe_customer_id;
    else if (who.user.email) form.customer_email = who.user.email;
    const session = await stripe("checkout/sessions", form);
    return json({ url: session.url });
  } catch (_e) {
    return json({ error: "The payment page could not be opened. Please try again." }, 502);
  }
});
