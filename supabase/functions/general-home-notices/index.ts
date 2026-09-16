import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient, userClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

const NOTICE_FIELDS = [
  "id",
  "organizationId",
  "label",
  "message",
  "status",
  "isEnabled",
  "startsAt",
  "endsAt",
  "backgroundColor",
  "textColor",
  "accentColor",
  "linkLabel",
  "linkPath",
  "priority",
];

const SELECT_FIELDS = "id,organization_id,label,message,status,is_enabled,starts_at,ends_at,background_color,text_color,accent_color,link_label,link_path,priority,published_at,created_at,updated_at";
const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function optionalText(value: unknown, field: string, maxLength: number) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return requiredString(value, field, maxLength);
}

function timestamp(value: unknown, field: string, required = false) {
  if (value === undefined) return undefined;
  if ((value === null || value === "") && !required) return null;
  const text = requiredString(value, field, 40);
  if (Number.isNaN(Date.parse(text))) throw new ApiError("VALIDATION_FAILED", `${field} must be a valid ISO timestamp`, 422);
  return text;
}

function color(value: unknown, field: string) {
  const text = requiredString(value, field, 7);
  if (!COLOR_PATTERN.test(text)) throw new ApiError("VALIDATION_FAILED", `${field} must be a 6-digit hex colour`, 422);
  return text.toUpperCase();
}

function priority(value: unknown) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < -100 || number > 100) throw new ApiError("VALIDATION_FAILED", "priority must be a whole number between -100 and 100", 422);
  return number;
}

function validateLinkPath(value: unknown) {
  const path = optionalText(value, "linkPath", 300);
  if (path && !(path === "/general" || path.startsWith("/general/"))) {
    throw new ApiError("VALIDATION_FAILED", "The update-strip link must stay inside General COT", 422);
  }
  return path;
}

async function resolveOrganizationId(request: Request, bodyOrganizationId?: unknown) {
  const url = new URL(request.url);
  const candidate = bodyOrganizationId === undefined ? url.searchParams.get("organizationId") : bodyOrganizationId;
  if (candidate) return uuid(String(candidate), "organizationId", true)!;

  const admin = adminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("id")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(2);
  if (error) throw new ApiError("ORGANIZATION_LOOKUP_FAILED", "Unable to resolve General COT", 500, undefined, false);
  if ((data ?? []).length !== 1) throw new ApiError("ORGANIZATION_REQUIRED", "Choose a church before loading General COT updates", 422);
  return data![0].id;
}

async function requireManager(request: Request, organizationId: string) {
  const token = bearerToken(request);
  if (!token) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
  const client = userClient(token);
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) throw new ApiError("INVALID_SESSION", "Session is invalid or expired", 401);
  const { data: allowed, error } = await client.rpc("has_permission", {
    target_organization_id: organizationId,
    requested_permission: "announcements.manage",
    target_branch_id: null,
  });
  if (error || allowed !== true) throw new ApiError("PERMISSION_DENIED", "You do not have permission to manage General COT updates", 403);
  return userData.user;
}

function buildRecord(body: Record<string, unknown>, creating: boolean) {
  const record: Record<string, unknown> = {};
  if (creating || body.label !== undefined) record.label = requiredString(body.label ?? "COT UPDATE", "label", 60);
  if (creating || body.message !== undefined) record.message = requiredString(body.message, "message", 800);

  if (body.status !== undefined || creating) {
    const status = String(body.status ?? "draft");
    if (!new Set(["draft", "published"]).has(status)) throw new ApiError("VALIDATION_FAILED", "status must be draft or published", 422);
    record.status = status;
    record.published_at = status === "published" ? new Date().toISOString() : null;
  }
  if (body.isEnabled !== undefined || creating) record.is_enabled = body.isEnabled === undefined ? true : Boolean(body.isEnabled);
  if (body.startsAt !== undefined || creating) record.starts_at = timestamp(body.startsAt ?? new Date().toISOString(), "startsAt", true);
  if (body.endsAt !== undefined) record.ends_at = timestamp(body.endsAt, "endsAt");
  if (body.backgroundColor !== undefined || creating) record.background_color = color(body.backgroundColor ?? "#082F49", "backgroundColor");
  if (body.textColor !== undefined || creating) record.text_color = color(body.textColor ?? "#F8FAFC", "textColor");
  if (body.accentColor !== undefined || creating) record.accent_color = color(body.accentColor ?? "#38BDF8", "accentColor");
  if (body.linkLabel !== undefined) record.link_label = optionalText(body.linkLabel, "linkLabel", 80);
  if (body.linkPath !== undefined) record.link_path = validateLinkPath(body.linkPath);
  if (body.priority !== undefined || creating) record.priority = body.priority === undefined ? 0 : priority(body.priority);

  const startsAt = record.starts_at ? Date.parse(String(record.starts_at)) : null;
  const endsAt = record.ends_at ? Date.parse(String(record.ends_at)) : null;
  if (startsAt !== null && endsAt !== null && endsAt <= startsAt) throw new ApiError("VALIDATION_FAILED", "End time must be after the start time", 422);
  return record;
}

Deno.serve(createHandler(
  { methods: ["GET", "POST", "PATCH", "DELETE"], authentication: "none", organization: "none" },
  async ({ request }) => {
    const url = new URL(request.url);
    const admin = adminClient();

    if (request.method === "GET") {
      const organizationId = await resolveOrganizationId(request);
      const manage = url.searchParams.get("mode") === "manage";
      if (manage) {
        await requireManager(request, organizationId);
        const { data, error } = await admin
          .from("general_home_notices")
          .select(SELECT_FIELDS)
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw new ApiError("HOME_NOTICE_LIST_FAILED", "Unable to load General COT update strips", 500, undefined, false);
        return { data: data ?? [] };
      }

      const now = new Date().toISOString();
      const { data, error } = await admin
        .from("general_home_notices")
        .select(SELECT_FIELDS)
        .eq("organization_id", organizationId)
        .eq("status", "published")
        .eq("is_enabled", true)
        .lte("starts_at", now)
        .order("priority", { ascending: false })
        .order("starts_at", { ascending: false })
        .limit(20);
      if (error) throw new ApiError("HOME_NOTICE_FETCH_FAILED", "Unable to load the General COT update strip", 500, undefined, false);
      const active = (data ?? []).find((item) => !item.ends_at || Date.parse(item.ends_at) > Date.now()) ?? null;
      return { data: active };
    }

    if (request.method === "DELETE") {
      const organizationId = await resolveOrganizationId(request);
      const user = await requireManager(request, organizationId);
      const id = uuid(url.searchParams.get("id"), "id", true)!;
      const { error } = await admin
        .from("general_home_notices")
        .delete()
        .eq("id", id)
        .eq("organization_id", organizationId);
      if (error) throw new ApiError("HOME_NOTICE_DELETE_FAILED", "Unable to delete this General COT update strip", 500, undefined, false);
      return { data: { id, deleted: true, deletedBy: user.id } };
    }

    const body = assertObject(await jsonBody(request));
    assertNoUnknownFields(body, NOTICE_FIELDS);
    const organizationId = await resolveOrganizationId(request, body.organizationId);
    const user = await requireManager(request, organizationId);
    const record = buildRecord(body, request.method === "POST");
    record.updated_by = user.id;
    record.updated_at = new Date().toISOString();

    if (request.method === "POST") {
      Object.assign(record, { organization_id: organizationId, created_by: user.id });
      const { data, error } = await admin.from("general_home_notices").insert(record).select(SELECT_FIELDS).single();
      if (error) throw new ApiError("HOME_NOTICE_CREATE_FAILED", "Unable to create the General COT update strip", 500, undefined, false);
      return { data, status: 201 };
    }

    const id = uuid(String(body.id ?? ""), "id", true)!;
    const { data, error } = await admin
      .from("general_home_notices")
      .update(record)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select(SELECT_FIELDS)
      .maybeSingle();
    if (error) throw new ApiError("HOME_NOTICE_UPDATE_FAILED", "Unable to update the General COT update strip", 500, undefined, false);
    if (!data) throw new ApiError("HOME_NOTICE_NOT_FOUND", "This General COT update strip is no longer available", 404);
    return { data };
  },
));
