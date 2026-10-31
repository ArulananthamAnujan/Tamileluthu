// Sends email from the school's own mailbox (SMTP), e.g. Hostinger Email or Gmail.
// Secrets (Supabase → Edge Functions → Secrets):
//   SMTP_HOST   smtp.hostinger.com   (Gmail: smtp.gmail.com)
//   SMTP_PORT   465                  (Supabase blocks 25 and 587, so use 465)
//   SMTP_USER   office@yourschool.org
//   SMTP_PASS   the mailbox password (Gmail: an App Password)
//   NOTIFY_FROM optional, e.g. "Melbourne Tamil School <office@yourschool.org>"
// Resend (RESEND_API_KEY) still works as a fallback if SMTP is not set.
import nodemailer from "npm:nodemailer@6.9.16";

export type Mail = { to: string; subject: string; html: string; replyTo?: string };

const HOST = Deno.env.get("SMTP_HOST") ?? "";
const PORT = Number(Deno.env.get("SMTP_PORT") || 465);
const USER = Deno.env.get("SMTP_USER") ?? "";
const PASS = Deno.env.get("SMTP_PASS") ?? "";
const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("NOTIFY_FROM") || USER;

export const EMAIL = /^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$/;
export const mailReady = () => Boolean((HOST && USER && PASS) || (RESEND && FROM));

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
function smtp() {
  transport ||= nodemailer.createTransport({
    host: HOST, port: PORT, secure: PORT === 465,
    auth: { user: USER, pass: PASS },
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000,
  });
  return transport;
}

// Returns how many were sent. Never throws, so one bad address does not stop the rest.
export async function sendMails(list: Mail[], fromName?: string): Promise<number> {
  const valid = list.filter((m) => EMAIL.test(m.to));
  if (!valid.length) return 0;
  const from = fromName && !FROM.includes("<") ? `"${fromName.replace(/"/g, "")}" <${FROM}>` : FROM;
  let sent = 0;
  if (HOST && USER && PASS) {
    for (const m of valid) {
      try { await smtp().sendMail({ from, to: m.to, subject: m.subject, html: m.html, replyTo: m.replyTo }); sent++; }
      catch (e) { console.error("SMTP send failed:", (e as Error).message); }
    }
    return sent;
  }
  if (RESEND && FROM) {
    for (let i = 0; i < valid.length; i += 100) {
      const batch = valid.slice(i, i + 100).map((m) => ({ from, to: [m.to], subject: m.subject, html: m.html, reply_to: m.replyTo }));
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST", signal: AbortSignal.timeout(20000),
        headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      }).catch(() => null);
      if (res?.ok) sent += batch.length;
    }
  }
  return sent;
}
