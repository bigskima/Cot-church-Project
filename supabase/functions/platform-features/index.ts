import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { loadEffectiveFeatures, resolveFeatureScope } from "../_shared/feature-controls.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

function rollout(value: unknown, field = "rolloutPercentage") {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 100) {
    throw new ApiError("VALIDATION_FAILED", `${field} must be an integer between 0 and 100`, 422);
  }
  return number;
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function featureDefinition(admin: any, key: string) {
  const { data, error } = await admin
    .from("platform_feature_flags")
    .select("key,name,category,description,global_enabled,rollout_percentage,configuration")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) throw new ApiError("FEATURE_NOT_FOUND", "Feature flag not found", 404);
  return data;
}

function supportsScope(flag: any, scopeType: string) {
  const scopes = objectValue(flag.configuration).scopes;
  if (!Array.isArray(scopes) || scopes.length === 0) return true;
  return scopes.includes(scopeType);
}

async function loadScopeDirectory(admin: any) {
  const [organizationsResult, expressionsResult, groupsResult] = await Promise.all([
    admin
      .from("organizations")
      .select("id,name,slug,status")
      .order("name", { ascending: true })
      .limit(500),
    admin
      .from("branches")
      .select("id,organization_id,name,code,is_active")
      .order("name", { ascending: true })
      .limit(1000),
    admin
      .from("groups")
      .select("id,organization_id,branch_id,name,is_active")
      .order("name", { ascending: true })
      .limit(1500),
  ]);
  if (organizationsResult.error || expressionsResult.error || groupsResult.error) {
    throw new ApiError("FEATURE_SCOPES_FAILED", "Unable to load app-control scopes.", 500, undefined, false);
  }
  return {
    organizations: organizationsResult.data ?? [],
    expressions: expressionsResult.data ?? [],
    groups: groupsResult.data ?? [],
  };
}

async function saveScopedOverride(
  admin: any,
  auth: any,
  requestId: string,
  body: Record<string, unknown>,
) {
  assertNoUnknownFields(body, [
    "action",
    "scopeType",
    "organizationId",
    "expressionId",
    "groupId",
    "key",
    "enabled",
    "rolloutPercentage",
    "configuration",
    "reason",
  ]);
  const scopeType = requiredString(body.scopeType, "scopeType", 24);
  if (!["organization", "expression", "group"].includes(scopeType)) {
    throw new ApiError("VALIDATION_FAILED", "Choose organization, expression or group scope.", 422);
  }
  const key = requiredString(body.key, "key", 96);
  if (typeof body.enabled !== "boolean") {
    throw new ApiError("VALIDATION_FAILED", "enabled must be a boolean", 422);
  }
  const reason = requiredString(body.reason, "reason", 1000);
  const rolloutPercentage = body.rolloutPercentage === null || body.rolloutPercentage === undefined
    ? null
    : rollout(body.rolloutPercentage);
  if (body.configuration !== undefined && (!body.configuration || typeof body.configuration !== "object" || Array.isArray(body.configuration))) {
    throw new ApiError("VALIDATION_FAILED", "configuration must be an object", 422);
  }

  const rawOrganizationId = body.organizationId ? uuid(requiredString(body.organizationId, "organizationId", 64), "organizationId", true)! : null;
  const rawExpressionId = body.expressionId ? uuid(requiredString(body.expressionId, "expressionId", 64), "expressionId", true)! : null;
  const rawGroupId = body.groupId ? uuid(requiredString(body.groupId, "groupId", 64), "groupId", true)! : null;
  const scope = await resolveFeatureScope(admin, {
    organizationId: rawOrganizationId,
    expressionId: rawExpressionId,
    groupId: rawGroupId,
  });
  const flag = await featureDefinition(admin, key);
  if (!supportsScope(flag, scopeType)) {
    throw new ApiError("FEATURE_SCOPE_UNSUPPORTED", `${flag.name} does not support ${scopeType} overrides.`, 422);
  }

  let table = "";
  let conflict = "";
  let targetType = "";
  let targetId: string | null = null;
  let row: Record<string, unknown> = {
    organization_id: scope.organizationId,
    feature_key: key,
    enabled: body.enabled,
    rollout_percentage: rolloutPercentage,
    configuration: body.configuration ?? {},
    reason,
    updated_by: auth.user.id,
  };

  if (scopeType === "organization") {
    if (!scope.organizationId || rawExpressionId || rawGroupId) {
      throw new ApiError("VALIDATION_FAILED", "Organization scope requires only organizationId.", 422);
    }
    table = "organization_feature_overrides";
    conflict = "organization_id,feature_key";
    targetType = "organization";
    targetId = scope.organizationId;
  } else if (scopeType === "expression") {
    if (!scope.organizationId || !scope.expressionId || rawGroupId) {
      throw new ApiError("VALIDATION_FAILED", "Expression scope requires expressionId.", 422);
    }
    table = "expression_feature_overrides";
    conflict = "expression_id,feature_key";
    targetType = "expression";
    targetId = scope.expressionId;
    row = { ...row, expression_id: scope.expressionId };
  } else {
    if (!scope.organizationId || !scope.groupId) {
      throw new ApiError("VALIDATION_FAILED", "Group scope requires groupId.", 422);
    }
    table = "group_feature_overrides";
    conflict = "group_id,feature_key";
    targetType = "group";
    targetId = scope.groupId;
    row = { ...row, expression_id: scope.expressionId, group_id: scope.groupId };
  }

  const { data: saved, error } = await admin
    .from(table)
    .upsert(row, { onConflict: conflict })
    .select()
    .single();
  if (error) throw new ApiError("FEATURE_OVERRIDE_UPDATE_FAILED", "Unable to save scoped feature override", 500, undefined, false);

  const { error: auditError } = await admin.from("platform_audit_log").insert({
    actor_profile_id: auth.user.id,
    action: `feature.${scopeType}_override_saved`,
    target_type: targetType,
    target_id: targetId,
    request_id: requestId,
    metadata: {
      featureKey: key,
      enabled: body.enabled,
      rolloutPercentage,
      reason,
      scope,
    },
  });
  if (auditError) {
    throw new ApiError("PLATFORM_AUDIT_FAILED", "Feature control changed but the audit record could not be written", 500, undefined, false);
  }

  return saved;
}

async function clearScopedOverride(
  admin: any,
  auth: any,
  requestId: string,
  body: Record<string, unknown>,
) {
  assertNoUnknownFields(body, ["action", "scopeType", "organizationId", "expressionId", "groupId", "key", "reason"]);
  const scopeType = requiredString(body.scopeType, "scopeType", 24);
  if (!["organization", "expression", "group"].includes(scopeType)) {
    throw new ApiError("VALIDATION_FAILED", "Choose organization, expression or group scope.", 422);
  }
  const key = requiredString(body.key, "key", 96);
  const reason = requiredString(body.reason, "reason", 1000);
  const rawOrganizationId = body.organizationId ? uuid(requiredString(body.organizationId, "organizationId", 64), "organizationId", true)! : null;
  const rawExpressionId = body.expressionId ? uuid(requiredString(body.expressionId, "expressionId", 64), "expressionId", true)! : null;
  const rawGroupId = body.groupId ? uuid(requiredString(body.groupId, "groupId", 64), "groupId", true)! : null;
  const scope = await resolveFeatureScope(admin, {
    organizationId: rawOrganizationId,
    expressionId: rawExpressionId,
    groupId: rawGroupId,
  });

  let table = "";
  let column = "";
  let id = "";
  let targetType = "";
  if (scopeType === "organization" && scope.organizationId && !rawExpressionId && !rawGroupId) {
    table = "organization_feature_overrides";
    column = "organization_id";
    id = scope.organizationId;
    targetType = "organization";
  } else if (scopeType === "expression" && scope.expressionId && !rawGroupId) {
    table = "expression_feature_overrides";
    column = "expression_id";
    id = scope.expressionId;
    targetType = "expression";
  } else if (scopeType === "group" && scope.groupId) {
    table = "group_feature_overrides";
    column = "group_id";
    id = scope.groupId;
    targetType = "group";
  } else {
    throw new ApiError("VALIDATION_FAILED", "The selected scope is incomplete.", 422);
  }

  const { error } = await admin.from(table).delete().eq(column, id).eq("feature_key", key);
  if (error) throw new ApiError("FEATURE_OVERRIDE_DELETE_FAILED", "Unable to clear scoped feature override", 500, undefined, false);

  const { error: auditError } = await admin.from("platform_audit_log").insert({
    actor_profile_id: auth.user.id,
    action: `feature.${scopeType}_override_cleared`,
    target_type: targetType,
    target_id: id,
    request_id: requestId,
    metadata: { featureKey: key, reason, scope },
  });
  if (auditError) {
    throw new ApiError("PLATFORM_AUDIT_FAILED", "Feature control changed but the audit record could not be written", 500, undefined, false);
  }

  return { key, cleared: true, scope };
}

Deno.serve(
  createHandler(
    { methods: ["GET", "PATCH"], authentication: "required", organization: "none" },
    async ({ request, requestId, auth }) => {
      if (!auth) throw new Error("Authentication context missing");
      const admin = adminClient();

      if (request.method === "GET") {
        await authorizePlatform(auth, "platform.features.read");
        const url = new URL(request.url);
        if (url.searchParams.get("view") === "scopes") {
          return { data: await loadScopeDirectory(admin) };
        }

        const organizationId = uuid(url.searchParams.get("organizationId"), "organizationId");
        const expressionId = uuid(url.searchParams.get("expressionId"), "expressionId");
        const groupId = uuid(url.searchParams.get("groupId"), "groupId");
        const state = await loadEffectiveFeatures(admin, { organizationId, expressionId, groupId });
        return {
          data: {
            organizationId: state.scope.organizationId,
            expressionId: state.scope.expressionId,
            groupId: state.scope.groupId,
            items: state.items,
          },
        };
      }

      await authorizePlatform(auth, "platform.features.manage");
      const body = assertObject(await jsonBody(request));
      const action = requiredString(body.action, "action", 48);

      if (action === "set_global") {
        assertNoUnknownFields(body, ["action", "key", "enabled", "rolloutPercentage", "configuration", "reason"]);
        const key = requiredString(body.key, "key", 96);
        if (typeof body.enabled !== "boolean") throw new ApiError("VALIDATION_FAILED", "enabled must be a boolean", 422);
        const rolloutPercentage = rollout(body.rolloutPercentage);
        const reason = optionalString(body.reason, "reason", 1000) ?? null;
        if (!body.enabled && !reason) {
          throw new ApiError("VALIDATION_FAILED", "A governance reason is required when globally disabling a feature", 422, { reason: "Required" });
        }
        if (body.configuration !== undefined && (!body.configuration || typeof body.configuration !== "object" || Array.isArray(body.configuration))) {
          throw new ApiError("VALIDATION_FAILED", "configuration must be an object", 422);
        }

        const { data: current, error: currentError } = await admin
          .from("platform_feature_flags")
          .select("key,name,global_enabled,rollout_percentage,configuration")
          .eq("key", key)
          .maybeSingle();
        if (currentError || !current) throw new ApiError("FEATURE_NOT_FOUND", "Feature flag not found", 404);

        const updates: Record<string, unknown> = {
          global_enabled: body.enabled,
          rollout_percentage: rolloutPercentage,
          updated_by: auth.user.id,
        };
        if (body.configuration !== undefined) updates.configuration = body.configuration;

        const { data: updated, error } = await admin
          .from("platform_feature_flags")
          .update(updates)
          .eq("key", key)
          .select("key,name,category,description,global_enabled,rollout_percentage,configuration,updated_at")
          .single();
        if (error) throw new ApiError("FEATURE_UPDATE_FAILED", "Unable to update global feature state", 500, undefined, false);

        const { error: auditError } = await admin.from("platform_audit_log").insert({
          actor_profile_id: auth.user.id,
          action: "feature.global_updated",
          target_type: "platform_feature_flag",
          target_id: null,
          request_id: requestId,
          metadata: {
            key,
            previousEnabled: current.global_enabled,
            newEnabled: body.enabled,
            previousRolloutPercentage: current.rollout_percentage,
            newRolloutPercentage: rolloutPercentage,
            reason,
          },
        });
        if (auditError) {
          throw new ApiError("PLATFORM_AUDIT_FAILED", "Feature control changed but the audit record could not be written", 500, undefined, false);
        }
        return { data: updated };
      }

      if (action === "set_scope_override") {
        return { data: await saveScopedOverride(admin, auth, requestId, body) };
      }

      if (action === "clear_scope_override") {
        return { data: await clearScopedOverride(admin, auth, requestId, body) };
      }

      // Preserve the existing API contract used by older Platform Admin builds.
      if (action === "set_organization_override") {
        const translated = {
          ...body,
          action: "set_scope_override",
          scopeType: "organization",
        };
        return { data: await saveScopedOverride(admin, auth, requestId, translated) };
      }

      if (action === "clear_organization_override") {
        const translated = {
          ...body,
          action: "clear_scope_override",
          scopeType: "organization",
        };
        return { data: await clearScopedOverride(admin, auth, requestId, translated) };
      }

      throw new ApiError("VALIDATION_FAILED", "Unsupported platform feature action", 422);
    },
  ),
);
