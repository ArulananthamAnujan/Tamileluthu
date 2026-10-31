import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.118.0";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function admin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

// The caller's own client: every query runs with their row level security.
export async function caller(req: Request): Promise<{ user: User; db: SupabaseClient } | null> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!/^Bearer [^\s]+$/.test(auth)) return null;
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) return null;
  return { user, db };
}

// Only send people back to the site they came from (or the configured site).
export function siteUrl(req: Request): string {
  const configured = (Deno.env.get("SITE_URL") || "").replace(/\/+$/, "");
  const origin = req.headers.get("Origin") || "";
  if (configured) return configured;
  return /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin) ? origin : "";
}
