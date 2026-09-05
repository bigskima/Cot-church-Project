import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { enrichContentEngagement, enrichSocialPosts } from "../_shared/public-identity.ts";
import { adminClient, publicClient } from "../_shared/supabase.ts";
import { uuid } from "../_shared/validation.ts";

const scopes = new Set(["all", "church", "expression"]);

async function resolveOrganizationId(raw: string | null) {
  const admin = adminClient();
  if (raw) {
    const id = uuid(raw, "organizationId", true)!;
    const { data, error } = await admin
      .from("organizations")
      .select("id,status")
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle();
    if (error || !data) throw new ApiError("ORGANIZATION_NOT_FOUND", "This church is not available", 404);
    return id;
  }

  const { data, error } = await admin
    .from("organizations")
    .select("id")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(2);
  if (error) throw new ApiError("ORGANIZATION_LOOKUP_FAILED", "Unable to resolve the church community", 500, undefined, false);
  if ((data ?? []).length === 1) return data![0].id;
  throw new ApiError("ORGANIZATION_REQUIRED", "Choose a church to view its community", 422);
}

Deno.serve(createHandler(
  { methods: ["GET"], authentication: "optional", organization: "none" },
  async ({ request, auth }) => {
    const url = new URL(request.url);
    const organizationId = await resolveOrganizationId(url.searchParams.get("organizationId"));
    const expressionParam = url.searchParams.get("expressionId");
    const expressionId = expressionParam ? uuid(expressionParam, "expressionId", true) : null;
    const scope = url.searchParams.get("scope") ?? "all";

    if (!scopes.has(scope)) throw new ApiError("VALIDATION_FAILED", "Invalid community feed scope", 422);
    if (scope === "expression" && !expressionId) {
      throw new ApiError("VALIDATION_FAILED", "expressionId is required for an Expression public feed", 422);
    }

    if (expressionId) {
      const { data: expression, error } = await adminClient()
        .from("branches")
        .select("id,is_active")
        .eq("id", expressionId)
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .maybeSingle();
      if (error || !expression) throw new ApiError("EXPRESSION_NOT_FOUND", "This Expression is not available", 404);
    }

    const publicDb = publicClient();
    let query = publicDb
      .from("social_posts")
      .select("id,organization_id,author_membership_id,branch_id,group_id,visibility,status,body,media,published_at,edited_at,created_at")
      .eq("organization_id", organizationId)
      .eq("visibility", "public")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(100);

    if (scope === "church") query = query.is("branch_id", null);
    if (scope === "expression") query = query.eq("branch_id", expressionId!);

    const { data, error } = await query;
    if (error) throw new ApiError("PUBLIC_FEED_FAILED", "Unable to retrieve public community posts", 500, undefined, false);
    const identified = await enrichSocialPosts(data ?? []);
    const engaged = await enrichContentEngagement(
      identified,
      auth?.client ?? publicDb,
      auth?.user.id,
    );
    return { data: engaged };
  },
));