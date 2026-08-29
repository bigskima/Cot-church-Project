import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, uuid } from "../_shared/validation.ts";

Deno.serve(createHandler(
  { methods: ["GET", "POST"], authentication: "required", organization: "optional" },
  async ({ request, auth }) => {
    if (!auth?.user) {
      throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
    }

    if (request.method === "GET") {
      const { data, error } = await auth.client
        .from("follows")
        .select(`
          id,
          organization_id,
          expression_id,
          leader_id,
          created_at,
          organizations(id, name, slug),
          branches(id, name, city, state),
          leaders(id, name, role_title, avatar_url)
        `)
        .eq("profile_id", auth.user.id);

      if (error) throw new ApiError("FOLLOWS_FETCH_FAILED", "Unable to retrieve follows", 500, undefined, false);
      return { data: data ?? [] };
    }

    if (request.method === "POST") {
      const body = assertObject(await jsonBody(request));
      assertNoUnknownFields(body, ["action", "organizationId", "expressionId", "leaderId"]);

      const targetOrg = body.organizationId ? uuid(String(body.organizationId), "organizationId", true) : null;
      const targetExp = body.expressionId ? uuid(String(body.expressionId), "expressionId", true) : null;
      const targetLeader = body.leaderId ? uuid(String(body.leaderId), "leaderId", true) : null;

      const nonNullCount = [targetOrg, targetExp, targetLeader].filter(Boolean).length;
      if (nonNullCount !== 1) {
        throw new ApiError("VALIDATION_FAILED", "Exactly one follow target (organization, expression, or leader) must be specified", 422);
      }

      // Check if already following
      let existingQuery = auth.client
        .from("follows")
        .select("id")
        .eq("profile_id", auth.user.id);

      if (targetOrg) existingQuery = existingQuery.eq("organization_id", targetOrg);
      if (targetExp) existingQuery = existingQuery.eq("expression_id", targetExp);
      if (targetLeader) existingQuery = existingQuery.eq("leader_id", targetLeader);

      const { data: existing } = await existingQuery.maybeSingle();

      if (existing) {
        // Unfollow
        const { error: deleteErr } = await auth.client
          .from("follows")
          .delete()
          .eq("id", existing.id);

        if (deleteErr) throw new ApiError("UNFOLLOW_FAILED", "Unable to unfollow target", 500, undefined, false);
        return { data: { following: false } };
      }

      // Follow
      const { data: created, error: insertErr } = await auth.client
        .from("follows")
        .insert({
          profile_id: auth.user.id,
          organization_id: targetOrg,
          expression_id: targetExp,
          leader_id: targetLeader,
        })
        .select()
        .single();

      if (insertErr) throw new ApiError("FOLLOW_FAILED", "Unable to follow target", 500, undefined, false);
      return { data: { following: true, follow: created }, status: 201 };
    }
  }
));
