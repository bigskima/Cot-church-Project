import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { enrichSocialPosts } from "../_shared/public-identity.ts";
import { publicClient } from "../_shared/supabase.ts";
import { uuid } from "../_shared/validation.ts";

const scopes = new Set(["all", "church", "expression"]);

Deno.serve(createHandler(
  { methods: ["GET"], authentication: "none", organization: "none" },
  async ({ request }) => {
    const url = new URL(request.url);
    const organizationParam = url.searchParams.get("organizationId");
    const expressionParam = url.searchParams.get("expressionId");
    const organizationId = organizationParam ? uuid(organizationParam, "organizationId", true) : null;
    const expressionId = expressionParam ? uuid(expressionParam, "expressionId", true) : null;
    const scope = url.searchParams.get("scope") ?? "all";
    if (!scopes.has(scope)) throw new ApiError("VALIDATION_FAILED", "Invalid community feed scope", 422);
    if (scope === "expression" && !expressionId) {
      throw new ApiError("VALIDATION_FAILED", "expressionId is required for an Expression public feed", 422);
    }

    let query = publicClient()
      .from("social_posts")
      .select("id,organization_id,author_membership_id,branch_id,group_id,visibility,status,body,media,published_at,edited_at,created_at,social_reactions(reaction)")
      .eq("visibility", "public")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(100);

    if (organizationId) query = query.eq("organization_id", organizationId);
    if (scope === "church") query = query.is("branch_id", null);
    if (scope === "expression") query = query.eq("branch_id", expressionId!);

    const { data, error } = await query;
    if (error) throw new ApiError("PUBLIC_FEED_FAILED", "Unable to retrieve public community posts", 500, undefined, false);
    return { data: await enrichSocialPosts(data ?? []) };
  },
));
