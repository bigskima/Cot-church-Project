import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertProfilesMayInteract } from "../_shared/safety.ts";
import { assertNoUnknownFields, assertObject, uuid } from "../_shared/validation.ts";

Deno.serve(createHandler(
  { methods: ["GET", "POST"], authentication: "required", organization: "optional" },
  async ({ request, auth }) => {
    if (!auth?.user) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);

    if (request.method === "GET") {
      const { data, error } = await auth.client
        .from("follows")
        .select(`
          id,
          organization_id,
          expression_id,
          leader_id,
          target_profile_id,
          created_at,
          organizations(id, name, slug),
          branches(id, name, city, state),
          leaders(id, name, role_title, avatar_url)
        `)
        .eq("profile_id", auth.user.id)
        .order("created_at", { ascending: false });

      if (error) throw new ApiError("FOLLOWS_FETCH_FAILED", "Unable to retrieve follows", 500, undefined, false);

      const targetIds = [...new Set((data ?? []).map((row: any) => row.target_profile_id).filter(Boolean))];
      const { data: profiles } = targetIds.length
        ? await adminClient()
            .from("profiles")
            .select("id,display_name,username,avatar_url,banner_url")
            .in("id", targetIds)
        : { data: [] as any[] };
      const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));

      return {
        data: (data ?? []).map((row: any) => ({
          ...row,
          target_profile: row.target_profile_id ? profileMap.get(row.target_profile_id) ?? null : null,
        })),
      };
    }

    const body = assertObject(await jsonBody(request));
    assertNoUnknownFields(body, ["action", "organizationId", "expressionId", "leaderId", "targetProfileId"]);

    const targetOrg = body.organizationId ? uuid(String(body.organizationId), "organizationId", true) : null;
    const targetExp = body.expressionId ? uuid(String(body.expressionId), "expressionId", true) : null;
    const targetLeader = body.leaderId ? uuid(String(body.leaderId), "leaderId", true) : null;
    const targetProfile = body.targetProfileId ? uuid(String(body.targetProfileId), "targetProfileId", true) : null;
    const action = body.action === undefined ? "toggle" : String(body.action);

    if (!["toggle", "follow", "unfollow"].includes(action)) {
      throw new ApiError("VALIDATION_FAILED", "action must be follow, unfollow, or toggle", 422);
    }

    const nonNullCount = [targetOrg, targetExp, targetLeader, targetProfile].filter(Boolean).length;
    if (nonNullCount !== 1) {
      throw new ApiError("VALIDATION_FAILED", "Exactly one follow target must be specified", 422);
    }

    if (targetProfile) {
      if (targetProfile === auth.user.id) throw new ApiError("VALIDATION_FAILED", "You cannot follow yourself", 422);
      const admin = adminClient();
      const { data: target, error: targetError } = await admin
        .from("profiles")
        .select("id")
        .eq("id", targetProfile)
        .maybeSingle();
      if (targetError) throw new ApiError("FOLLOW_TARGET_FAILED", "Unable to verify this profile", 500, undefined, false);
      if (!target) throw new ApiError("PROFILE_NOT_FOUND", "This profile is unavailable", 404);
      await assertProfilesMayInteract(admin, auth.user.id, targetProfile);
    }

    let existingQuery = auth.client
      .from("follows")
      .select("id")
      .eq("profile_id", auth.user.id);
    if (targetOrg) existingQuery = existingQuery.eq("organization_id", targetOrg);
    if (targetExp) existingQuery = existingQuery.eq("expression_id", targetExp);
    if (targetLeader) existingQuery = existingQuery.eq("leader_id", targetLeader);
    if (targetProfile) existingQuery = existingQuery.eq("target_profile_id", targetProfile);

    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError) throw new ApiError("FOLLOW_LOOKUP_FAILED", "Unable to verify follow state", 500, undefined, false);

    const shouldFollow = action === "follow" || (action === "toggle" && !existing);
    if (!shouldFollow) {
      if (existing) {
        const { error: deleteErr } = await auth.client.from("follows").delete().eq("id", existing.id);
        if (deleteErr) throw new ApiError("UNFOLLOW_FAILED", "Unable to unfollow target", 500, undefined, false);
      }
      return { data: { following: false } };
    }

    if (existing) return { data: { following: true } };

    const { data: created, error: insertErr } = await auth.client
      .from("follows")
      .insert({
        profile_id: auth.user.id,
        organization_id: targetOrg,
        expression_id: targetExp,
        leader_id: targetLeader,
        target_profile_id: targetProfile,
      })
      .select()
      .single();

    if (insertErr?.code === "23505") return { data: { following: true } };
    if (insertErr) throw new ApiError("FOLLOW_FAILED", "Unable to follow target", 500, undefined, false);
    return { data: { following: true, follow: created }, status: 201 };
  },
));
