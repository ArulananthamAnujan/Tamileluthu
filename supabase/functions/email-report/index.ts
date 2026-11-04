// Emails the feedback for one piece of writing to a student or parent.
// Teachers can send their own checks and their students' work; students their own.
import { admin, caller, cors, json, UUID } from "../_shared/http.ts";
import { writingReportEmail } from "../_shared/emails.mjs";
import { EMAIL, mailReady, sendMails } from "../_shared/mail.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const who = await caller(req);
    if (!who) return json({ error: "Please sign in again." }, 401);
    const { submission_id, to, note } = await req.json().catch(() => ({}));
    if (typeof submission_id !== "string" || !UUID.test(submission_id)) return json({ error: "Unknown writing." }, 400);
    const list = [...new Set(String(to || "").split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => EMAIL.test(e)))];
    if (!list.length) return json({ error: "Enter an email address." }, 400);
    if (list.length > 5) return json({ error: "Send to up to 5 addresses at a time." }, 400);
    // Row level security decides whether this person may see the writing at all.
    const { data: sub } = await who.db.from("submissions").select("*").eq("id", submission_id).maybeSingle();
    if (!sub) return json({ error: "Not found." }, 404);
    if (sub.status !== "checked") return json({ error: "Wait until the check has finished." }, 400);
    if (!mailReady()) return json({ error: "School email is not set up yet. Use “Download PDF” and attach it, or share on WhatsApp." }, 503);
    const db = admin();
    const [{ data: me }, { data: owner }, { data: st }] = await Promise.all([
      db.from("profiles").select("full_name").eq("id", who.user.id).single(),
      db.from("profiles").select("full_name, role").eq("id", sub.student_id).single(),
      db.from("school_settings").select("school_name").eq("id", 1).maybeSingle(),
    ]);
    const school = st?.school_name || Deno.env.get("SCHOOL_NAME") || "Tamil Eluthu";
    const ctx = { school, teacher: me?.full_name || "", className: "", student: owner?.role === "student" ? owner.full_name : (sub.checked_for || "") };
    const msg = writingReportEmail(ctx, sub, typeof note === "string" ? note.slice(0, 1000) : "");
    const sent = await sendMails(list.map((e) => ({ to: e, ...msg, replyTo: who.user.email || undefined })), school);
    return json({ sent, total: list.length });
  } catch (_e) {
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
