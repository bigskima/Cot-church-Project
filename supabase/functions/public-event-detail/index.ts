import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cors(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return {};
  const configured = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  const allowed = configured.length === 0 || configured.includes("*") || configured.includes(origin) || origin.endsWith(".vercel.app") || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
  return allowed ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, content-type, x-request-id", "Access-Control-Allow-Methods": "GET, OPTIONS", Vary: "Origin" } : {};
}

function response(request: Request, data: unknown, status = 200) {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  return new Response(JSON.stringify(status >= 400 ? { error: data } : { data, meta: { requestId } }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Request-Id": requestId, ...cors(request) },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request) });
  if (request.method !== "GET") return response(request, { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" }, 405);

  const url = new URL(request.url);
  const eventId = url.searchParams.get("id")?.trim() ?? "";
  const organizationId = url.searchParams.get("organizationId")?.trim() || null;
  if (!uuidPattern.test(eventId) || (organizationId && !uuidPattern.test(organizationId))) {
    return response(request, { code: "VALIDATION_FAILED", message: "A valid event id is required" }, 422);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return response(request, { code: "SERVER_MISCONFIGURED", message: "Public event service is unavailable" }, 500);
  const client = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

  let query = client
    .from("events")
    .select("id,organization_id,branch_id,title,description,status,visibility,location,timezone,starts_at,ends_at,registration_opens_at,registration_closes_at,capacity,banner_url")
    .eq("id", eventId)
    .eq("visibility", "public")
    .eq("status", "published");
  if (organizationId) query = query.eq("organization_id", organizationId);

  const { data, error } = await query.maybeSingle();
  if (error) return response(request, { code: "PUBLIC_EVENT_FAILED", message: "Unable to retrieve this event" }, 500);
  if (!data) return response(request, { code: "EVENT_NOT_FOUND", message: "This event is not available" }, 404);
  return response(request, data);
});
