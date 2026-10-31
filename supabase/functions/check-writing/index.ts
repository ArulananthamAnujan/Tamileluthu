// Tamil Thiruthi — checking function (Supabase Edge Function, Deno)
// Called by a student right after they create a submission.
// 1. Reads the photos of handwriting (if any) and types them out exactly as written.
// 2. Checks the Tamil text for mistakes.
// 3. Saves the results on the submission. The website watches for the result.
//
// Secrets needed (Supabase Dashboard → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY   your Anthropic API key
//   ANTHROPIC_MODEL     optional, defaults to claude-sonnet-5-5
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CATEGORIES = [
  "pulli", "vowel", "l_sound", "n_sound", "r_sound", "double", "spelling",
  "sandhi", "word_order", "agreement", "pronoun", "case_ending", "english_pattern", "tense",
  "spoken", "english_word", "formality", "punctuation", "text_type",
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5";
const API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

type Content =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

async function askClaude(content: Content[], maxTokens = 8000): Promise<any> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) throw new Error(`Claude API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return parseJson(text);
}

function parseJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : text;
  const a = body.indexOf("{"), b = body.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("The checker did not return a result. Please try again.");
  return JSON.parse(body.slice(a, b + 1));
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function transcribePrompt(n: number): string {
  return `${n > 1 ? `These ${n} photos are pages, in order,` : "This photo is a page"} of a VCE student's HANDWRITTEN Tamil writing. Your only job is to type out exactly what the student wrote, so that a teacher can mark their mistakes.

Critical rules:
- Copy EXACTLY as written, letter by letter. Do NOT correct anything. Keep every spelling mistake, missing or extra புள்ளி, wrong vowel sign, wrong ல/ள/ழ, ன/ண/ந, ர/ற, missing வல்லினம், wrong word order, spoken Tamil and English words. If the student wrote "தமில்", you write "தமில்", not "தமிழ்".
- Keep the student's paragraphs, and separate lines for headings, greetings and sign-offs. Join lines that only wrap because the page ran out of room.
- Ignore crossed-out words, page numbers, ruled-line marks and any teacher's ticks or corrections.
- If a word is genuinely unreadable, type your best reading of the letters the student actually formed, and list it in "unclear".

Also note the student's handwriting: up to 4 short notes in simple English about letter formation a teacher should correct (for example: ெ written after the letter instead of before it, புள்ளி too faint or missing, ள and ன look the same, uneven letter size, letters not sitting on the line). Only notes you can actually see.

Reply with only one JSON object:
{"text":"the exact transcription","unclear":["word (what it might be)"],"handwriting":["note"]}`;
}

function checkPrompt(text: string, type: string): string {
  return `You are an experienced VCE Tamil teacher in Melbourne marking a student's writing. The student grew up speaking English, so many mistakes come from thinking in English. Find every real error in the Tamil text below.

Text type the student was asked to write: ${type}.

What to check:
- Spelling: missing புள்ளி, wrong or missing vowel signs, short vs long vowels, ல/ள/ழ, ன/ண/ந, ர/ற, missing double consonants.
- வல்லினம் மிகும் / புணர்ச்சி errors (e.g. அந்தப் பையன், பள்ளிக்குச் சென்றேன், கதையைக் கேட்டேன், படிக்கச் சென்றான்).
- Grammar: English word order (verb must be last), verb ending not matching the subject, wrong pronoun base before endings (நீங்களை → உங்களை, நானுக்கு → எனக்கு), wrong case endings (with/from/by), English patterns such as "is/am/are" (நான் இருக்கிறேன் மகிழ்ச்சி) or "who/which" (பையன் யார் வந்தான்), tense mixing.
- Style: spoken/colloquial Tamil in writing, English words written in Tamil script, mixing நீ and நீங்கள் forms, punctuation, and anything that does not suit the text type.

Do NOT flag: correct Sri Lankan or Indian Tamil variants (பாடசாலை/பள்ளி, பரீட்சை/தேர்வு, வைத்தியர்/மருத்துவர்), names, accepted loanwords with no common Tamil equivalent, or sentences that are correct but could be phrased differently.

Reply with only one JSON object in this shape:
{"issues":[{"wrong":"...","correct":"...","category":"...","rule":"...","explain":"..."}],"summary":"...","focus":"..."}

Rules for each issue:
- "wrong": copied EXACTLY, character for character, from the student's text: the smallest span that contains the error (usually one or two words; a whole clause only for word order or sentence-pattern errors). Never include line breaks.
- "correct": the exact replacement for that span.
- "category": one of: ${CATEGORIES.join(", ")}.
- "rule": the general rule in one short sentence of simple English that a 17-year-old can remember.
- "explain": at most 20 words of simple English on why this case breaks the rule.
- List issues in the order they appear. At most 40 issues.
"summary": two short sentences of encouraging feedback in English: what the student did well and the one pattern to work on.
"focus": the category id the student should practise most.
If there are no errors, return an empty issues array.

Student's text:
"""
${text}
"""`;
}

// Find each mistake in the text so the website can underline it.
function locate(text: string, raw: any[]) {
  const used: [number, number][] = [];
  let cursor = 0;
  const out: any[] = [];
  for (const r of raw || []) {
    if (!r || typeof r.wrong !== "string" || !r.wrong.trim()) continue;
    const w = r.wrong;
    let p = text.indexOf(w, cursor);
    if (p < 0) p = text.indexOf(w);
    while (p >= 0 && used.some(([s, e]) => p < e && p + w.length > s)) p = text.indexOf(w, p + 1);
    const item: any = {
      wrong: w,
      correct: typeof r.correct === "string" ? r.correct : null,
      category: CATEGORIES.includes(r.category) ? r.category : "spelling",
      rule: String(r.rule || ""),
      explain: String(r.explain || ""),
    };
    if (p >= 0) { item.start = p; item.end = p + w.length; used.push([p, item.end]); cursor = item.end; }
    out.push(item);
  }
  return out;
}

async function runCheck(subId: string) {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const { data: sub, error } = await admin.from("submissions").select("*").eq("id", subId).single();
    if (error || !sub) throw new Error("Submission not found.");
    let text: string = sub.original_text || "";
    let handwriting: string[] = [], unclear: string[] = [];

    if (sub.input_mode === "photo" && sub.photo_paths.length) {
      const images: Content[] = [];
      for (const path of sub.photo_paths) {
        const { data: file, error: dErr } = await admin.storage.from("writing").download(path);
        if (dErr || !file) throw new Error("A photo could not be opened.");
        images.push({ type: "image", source: { type: "base64", media_type: file.type || "image/jpeg", data: toBase64(await file.arrayBuffer()) } });
      }
      const t = await askClaude([...images, { type: "text", text: transcribePrompt(images.length) }]);
      text = typeof t.text === "string" ? t.text.trim() : "";
      handwriting = Array.isArray(t.handwriting) ? t.handwriting.map(String).slice(0, 4) : [];
      unclear = Array.isArray(t.unclear) ? t.unclear.map(String).slice(0, 10) : [];
      if (!text) throw new Error("No Tamil writing was found in the photos. Try clearer photos.");
    }
    if (!text.trim()) throw new Error("There is no writing to check.");

    const c = await askClaude([{ type: "text", text: checkPrompt(text, sub.text_type || "general writing") }]);
    const issues = locate(text, Array.isArray(c.issues) ? c.issues : []);
    await admin.from("submissions").update({
      original_text: text,
      issues,
      summary: typeof c.summary === "string" ? c.summary : null,
      focus: CATEGORIES.includes(c.focus) ? c.focus : null,
      handwriting,
      unclear,
      status: "checked",
      error: null,
      checked_at: new Date().toISOString(),
    }).eq("id", subId);
  } catch (e) {
    await admin.from("submissions").update({ status: "error", error: String((e as Error).message || e).slice(0, 500) }).eq("id", subId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!API_KEY) return json({ error: "The checker is not set up yet (missing ANTHROPIC_API_KEY)." }, 500);

  // Who is calling? Only the student who owns the submission may start a check.
  const auth = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Please sign in again." }, 401);

  const { submission_id } = await req.json().catch(() => ({}));
  if (!submission_id) return json({ error: "Missing submission_id." }, 400);
  const { data: sub } = await userClient.from("submissions").select("id, student_id, status").eq("id", submission_id).single();
  if (!sub || sub.student_id !== user.id) return json({ error: "You can only check your own writing." }, 403);
  if (sub.status === "checking") return json({ ok: true, status: "checking" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  await admin.from("submissions").update({ status: "checking", error: null }).eq("id", submission_id);

  // Run in the background so the website doesn't wait on the connection.
  // @ts-ignore EdgeRuntime is provided by Supabase
  EdgeRuntime.waitUntil(runCheck(submission_id));
  return json({ ok: true, status: "checking" }, 202);
});
