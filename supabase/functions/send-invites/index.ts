// Emails class invitations from the school's mailbox. Only the class teacher can send.
import { admin, caller, cors, json, siteUrl, UUID } from "../_shared/http.ts";
import { inviteEmail } from "../_shared/emails.mjs";
import { EMAIL, mailReady, sendMails } from "../_shared/mail.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const who = await caller(req);
    if (!who) return json({ error: "Please sign in again." }, 401);
    const { class_id, emails, note } = await req.json().catch(() => ({}));
    if (typeof class_id !== "string" || !UUID.test(class_id) || !Array.isArray(emails)) return json({ error: "Nothing to send." }, 400);
    const list = [...new Set(emails.map((e: unknown) => String(e).trim().toLowerCase()).filter((e: string) => EMAIL.test(e)))];
    if (!list.length) return json({ error: "Add at least one valid email address." }, 400);
    if (list.length > 60) return json({ error: "Send up to 60 invitations at a time." }, 400);
    const { data: cls } = await who.db.from("classes").select("id, name, join_code").eq("id", class_id).eq("teacher_id", who.user.id).maybeSingle();
    if (!cls) return json({ error: "Only the class teacher can send invitations." }, 403);
    if (!mailReady()) return json({ error: "School email is not set up yet. Use “Copy link” or WhatsApp instead, or ask the admin to add the school mailbox." }, 503);
    const db = admin();
    const [{ data: me }, { data: st }] = await Promise.all([
      db.from("profiles").select("full_name").eq("id", who.user.id).single(),
      db.from("school_settings").select("school_name").eq("id", 1).maybeSingle(),
    ]);
    const school = st?.school_name || Deno.env.get("SCHOOL_NAME") || "Tamil School";
    const ctx = { school, site: siteUrl(req), className: cls.name, teacher: me?.full_name || "Your teacher", code: cls.join_code };
    const msg = inviteEmail(ctx, typeof note === "string" ? note.slice(0, 1000) : "");
    const sent = await sendMails(list.map((to) => ({ to, ...msg, replyTo: who.user.email || undefined })), school);
    return json({ sent, total: list.length });
  } catch (_e) {
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
