// Minimal Stripe REST helper (form-encoded), using STRIPE_SECRET_KEY.
const KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
export const stripeReady = () => Boolean(KEY);

export async function stripe(path: string, params?: Record<string, string>, method = params ? "POST" : "GET") {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${KEY}`, ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: params ? new URLSearchParams(params) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Stripe ${method} ${path} failed:`, res.status, body?.error?.message);
    throw new Error(body?.error?.message || `Stripe error ${res.status}`);
  }
  return body;
}

// Copy a Stripe subscription into public.subscriptions (works across Stripe API versions).
export async function syncSubscription(db: any, subscriptionId: string) {
  const sub = await stripe(`subscriptions/${encodeURIComponent(subscriptionId)}`);
  const studentId = sub.metadata?.student_id;
  if (!studentId) { console.error("Subscription without student_id metadata:", subscriptionId); return; }
  const item = sub.items?.data?.[0] || {};
  const start = sub.current_period_start ?? item.current_period_start;
  const end = sub.current_period_end ?? item.current_period_end;
  const status = ["active", "trialing"].includes(sub.status) ? "active"
    : ["past_due", "unpaid"].includes(sub.status) ? "past_due"
    : ["canceled", "incomplete_expired"].includes(sub.status) ? "canceled" : null;
  if (!status) return; // "incomplete": payment not finished yet
  const { data: current } = await db.from("subscriptions").select("status, current_period_end, stripe_subscription_id").eq("student_id", studentId).maybeSingle();
  // Don't let a cancelled Stripe plan cut short months the admin granted for cash.
  if (status === "canceled" && current?.status === "manual" && current.stripe_subscription_id !== sub.id) return;
  const { error } = await db.from("subscriptions").upsert({
    student_id: studentId,
    status,
    current_period_start: start ? new Date(start * 1000).toISOString() : null,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    stripe_subscription_id: sub.id,
    paid_by: sub.metadata?.payer_id || null,
    // The plan and its monthly allowance are saved on the Stripe subscription when it starts or changes.
    ...(sub.metadata?.plan_id ? { plan_id: sub.metadata.plan_id } : {}),
    ...(Number(sub.metadata?.checks_per_month) > 0 ? { checks_per_month: Number(sub.metadata.checks_per_month) } : {}),
    updated_at: new Date().toISOString(),
  }, { onConflict: "student_id" });
  if (error) throw new Error(`Could not save subscription: ${error.message}`);
}
