// Emails parents when a teacher sends a report, marks or a class notice.
// The teacher's own login decides what they may send (row level security);
// the email addresses are looked up with the service role and never returned.
// Secrets: RESEND_API_KEY, NOTIFY_FROM (e.g. "Tamil School <noreply@yourdomain.com>"), SITE_URL.
import { admin, caller, cors, json, siteUrl, UUID } from "../_shared/http.ts";
import { reportEmail, marksEmail, noticeEmail } from "./emails.mjs";

const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("NOTIFY_FROM") ?? "";
const SCHOOL = Deno.env.get("SCHOOL_NAME") || "Tamil School";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const who = await caller(req);
    if (!who) return json({ error: "Please sign in again." }, 401);
    const { kind, id } = await req.json().catch(() => ({}));
    if (!["report", "assessment", "activity"].includes(kind) || typeof id !== "string" || !UUID.test(id)) {
      return json({ error: "Nothing to send." }, 400);
    }
    const table = kind === "report" ? "reports" : kind === "assessment" ? "assessments" : "activities";
    const { data: item } = await who.db.from(table).select("*").eq("id", id).maybeSingle();
    if (!item) return json({ error: "Not found." }, 404);
    const { data: cls } = await who.db.from("classes").select("id, name").eq("id", item.class_id)
      .eq("teacher_id", who.user.id).maybeSingle();
    if (!cls) return json({ error: "Only the class teacher can send this." }, 403);
    if (item.notified_at && Date.now() - new Date(item.notified_at).getTime() < 10 * 60 * 1000) {
      return json({ error: "Already sent in the last 10 minutes." }, 429);
    }
    // Sending a report or marks also publishes it in the portal.
    if (kind !== "activity" && !item.published) {
      const { error } = await who.db.from(table).update({ published: true }).eq("id", id);
      if (error) return json({ error: "Could not publish." }, 400);
    }

    const db = admin();
    const site = siteUrl(req);
    let studentIds: string[];
    let marks: Record<string, { mark: number | null; absent: boolean; comment: string | null }> = {};
    if (kind === "report") studentIds = [item.student_id];
    else if (kind === "assessment") {
      const { data } = await db.from("marks").select("student_id, mark, absent, comment").eq("assessment_id", id);
      for (const m of data || []) marks[m.student_id] = m;
      studentIds = Object.keys(marks);
    } else {
      const { data } = await db.from("class_members").select("student_id").eq("class_id", cls.id);
      studentIds = (data || []).map((m) => m.student_id);
    }
    if (!studentIds.length) return json({ sent: 0, note: "No students to send to." });

    const [{ data: links }, { data: kids }, { data: me }] = await Promise.all([
      db.from("parent_links").select("parent_id, student_id").in("student_id", studentIds),
      db.from("profiles").select("id, full_name").in("id", studentIds),
      db.from("profiles").select("full_name").eq("id", who.user.id).single(),
    ]);
    const name = Object.fromEntries((kids || []).map((k) => [k.id, k.full_name || "your child"]));
    const parentEmail: Record<string, string> = {};
    for (const pid of new Set((links || []).map((l) => l.parent_id))) {
      const { data } = await db.auth.admin.getUserById(pid);
      if (data?.user?.email) parentEmail[pid] = data.user.email;
    }

    // One email per parent per child (parents of two children get two).
    const messages: { to: string; subject: string; html: string }[] = [];
    const { data: settings } = await db.from("school_settings").select("school_name").eq("id", 1).maybeSingle();
    const ctx = { school: settings?.school_name || SCHOOL, site, className: cls.name, teacher: me?.full_name || "Your teacher" };
    if (kind === "activity") {
      const tos = [...new Set(Object.values(parentEmail))];
      const m = noticeEmail(ctx, item);
      for (const to of tos) messages.push({ to, ...m });
    } else {
      for (const l of links || []) {
        const to = parentEmail[l.parent_id];
        if (!to) continue;
        const child = name[l.student_id];
        messages.push({ to, ...(kind === "report" ? reportEmail(ctx, child, item) : marksEmail(ctx, child, item, marks[l.student_id])) });
      }
    }

    if (!RESEND || !FROM) {
      await db.from(table).update({ notified_at: new Date().toISOString() }).eq("id", id);
      return json({ sent: 0, parents: messages.length, note: "Published in the portal. Email is not set up yet, so parents will see it when they sign in." });
    }
    let sent = 0;
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100).map((m) => ({ from: FROM, to: [m.to], subject: m.subject, html: m.html }));
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        signal: AbortSignal.timeout(20000),
        headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
      if (res.ok) sent += batch.length;
    }
    await db.from(table).update({ notified_at: new Date().toISOString() }).eq("id", id);
    return json({ sent, parents: messages.length, note: sent < messages.length ? "Some emails could not be sent." : undefined });
  } catch (_e) {
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
