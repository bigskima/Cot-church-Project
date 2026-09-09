import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-organization-id, x-branch-id, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const fail = (code: string, message: string, status: number) => new Response(JSON.stringify({ error: { code, message } }), { status, headers: cors });
const ok = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status, headers: cors });
const env = (name: string) => { const value = Deno.env.get(name)?.trim(); if (!value) throw new Error(`Missing ${name}`); return value; };
const isUuid = (value: string | null) => Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return fail("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    const organizationId = request.headers.get("x-organization-id");
    const branchId = request.headers.get("x-branch-id");
    if (!token) return fail("AUTHENTICATION_REQUIRED", "Please sign in to update Expression media.", 401);
    if (!isUuid(organizationId) || !isUuid(branchId)) return fail("EXPRESSION_REQUIRED", "Open the Expression before updating its media.", 422);

    const url = env("SUPABASE_URL");
    const anon = env("SUPABASE_ANON_KEY");
    const service = env("SUPABASE_SERVICE_ROLE_KEY");
    const client = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user) return fail("INVALID_SESSION", "Please sign in again to continue.", 401);

    const { data: membership } = await admin.from("expression_memberships")
      .select("id")
      .eq("organization_id", organizationId!)
      .eq("branch_id", branchId!)
      .eq("profile_id", userData.user.id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) return fail("EXPRESSION_MEMBERSHIP_REQUIRED", "Join this Expression before updating its media.", 403);

    const { data: allowed, error: permissionError } = await client.rpc("has_permission", {
      target_organization_id: organizationId,
      requested_permission: "branches.update",
      target_branch_id: branchId,
    });
    if (permissionError || allowed !== true) return fail("PERMISSION_DENIED", "You cannot edit this Expression.", 403);

    const form = await request.formData();
    const kind = String(form.get("kind") ?? "");
    if (!['avatar', 'banner'].includes(kind)) return fail("VALIDATION_FAILED", "Choose avatar or banner media.", 422);
    const file = form.get("file");
    if (!(file instanceof File)) return fail("VALIDATION_FAILED", "Choose an image to upload.", 422);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return fail("VALIDATION_FAILED", "Use a JPG, PNG or WebP image.", 422);
    if (file.size > 8 * 1024 * 1024) return fail("FILE_TOO_LARGE", "Expression images must be 8 MB or smaller.", 413);

    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${organizationId}/${branchId}/${kind}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await admin.storage.from("expression-media").upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' });
    if (uploadError) return fail("EXPRESSION_MEDIA_UPLOAD_FAILED", "We couldn’t upload this Expression image.", 500);
    const { data: publicData } = admin.storage.from("expression-media").getPublicUrl(path);
    const publicUrl = publicData.publicUrl;

    const column = kind === 'avatar' ? 'avatar_url' : 'banner_url';
    const { data: updated, error: updateError } = await admin.from("branches")
      .update({ [column]: publicUrl })
      .eq("id", branchId!)
      .eq("organization_id", organizationId!)
      .select("id,name,avatar_url,banner_url")
      .single();
    if (updateError) {
      await admin.storage.from("expression-media").remove([path]);
      return fail("EXPRESSION_MEDIA_UPDATE_FAILED", "We couldn’t save this Expression image.", 500);
    }
    return ok(updated, 201);
  } catch (error) {
    console.error("expression-media failed", error);
    return fail("EXPRESSION_MEDIA_FAILED", "Expression media is temporarily unavailable. Please try again.", 500);
  }
});
