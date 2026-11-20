import { ApiError } from "./errors.ts";

export type FeatureScopeInput = {
  organizationId?: string | null;
  expressionId?: string | null;
  groupId?: string | null;
};

export type ResolvedFeatureScope = {
  organizationId: string | null;
  expressionId: string | null;
  groupId: string | null;
};

type FeatureFlagRow = {
  key: string;
  name: string;
  category: string;
  description: string;
  global_enabled: boolean;
  rollout_percentage: number;
  configuration: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type OverrideRow = {
  enabled?: boolean | null;
  rollout_percentage?: number | null;
  configuration?: Record<string, unknown> | null;
  reason?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export type EffectiveFeature = FeatureFlagRow & {
  organization_override: OverrideRow | null;
  expression_override: OverrideRow | null;
  group_override: OverrideRow | null;
  direct_enabled: boolean;
  effective_enabled: boolean;
  effective_rollout_percentage: number;
  effective_configuration: Record<string, unknown>;
  inherited_from: "global" | "organization" | "expression" | "group";
  blocked_by: string | null;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function scopedRollout(parent: number, override?: OverrideRow | null) {
  const value = override?.rollout_percentage;
  return typeof value === "number" ? Math.min(parent, value) : parent;
}

function applyOverride(enabled: boolean, override?: OverrideRow | null) {
  if (!enabled) return false;
  if (!override || override.enabled === null || override.enabled === undefined) return enabled;
  return enabled && override.enabled === true;
}

function supportedScopes(flag: FeatureFlagRow) {
  const scopes = objectValue(flag.configuration).scopes;
  return Array.isArray(scopes) ? new Set(scopes.filter((item): item is string => typeof item === "string")) : new Set<string>();
}

function supports(flag: FeatureFlagRow, scope: "organization" | "expression" | "group") {
  const scopes = supportedScopes(flag);
  return scopes.size === 0 || scopes.has(scope);
}

export async function resolveFeatureScope(admin: any, input: FeatureScopeInput): Promise<ResolvedFeatureScope> {
  let organizationId = input.organizationId ?? null;
  let expressionId = input.expressionId ?? null;
  const groupId = input.groupId ?? null;

  if (groupId) {
    const { data: group, error } = await admin
      .from("groups")
      .select("id,organization_id,branch_id,is_active")
      .eq("id", groupId)
      .maybeSingle();
    if (error) throw new ApiError("FEATURE_SCOPE_FAILED", "Unable to resolve Group feature scope.", 500, undefined, false);
    if (!group || group.is_active === false) throw new ApiError("GROUP_NOT_FOUND", "Group not found.", 404);
    if (organizationId && organizationId !== group.organization_id) {
      throw new ApiError("FEATURE_SCOPE_MISMATCH", "Group does not belong to the selected church.", 422);
    }
    if (expressionId && expressionId !== group.branch_id) {
      throw new ApiError("FEATURE_SCOPE_MISMATCH", "Group does not belong to the selected Expression.", 422);
    }
    organizationId = group.organization_id;
    expressionId = group.branch_id ?? null;
  }

  if (expressionId) {
    const { data: expression, error } = await admin
      .from("branches")
      .select("id,organization_id,is_active")
      .eq("id", expressionId)
      .maybeSingle();
    if (error) throw new ApiError("FEATURE_SCOPE_FAILED", "Unable to resolve Expression feature scope.", 500, undefined, false);
    if (!expression || expression.is_active === false) throw new ApiError("EXPRESSION_NOT_FOUND", "Expression not found.", 404);
    if (organizationId && organizationId !== expression.organization_id) {
      throw new ApiError("FEATURE_SCOPE_MISMATCH", "Expression does not belong to the selected church.", 422);
    }
    organizationId = expression.organization_id;
  }

  return { organizationId, expressionId, groupId };
}

export async function loadEffectiveFeatures(admin: any, input: FeatureScopeInput = {}): Promise<{
  scope: ResolvedFeatureScope;
  items: EffectiveFeature[];
}> {
  const scope = await resolveFeatureScope(admin, input);

  const [flagsResult, organizationResult, expressionResult, groupResult] = await Promise.all([
    admin
      .from("platform_feature_flags")
      .select("key,name,category,description,global_enabled,rollout_percentage,configuration,created_at,updated_at")
      .order("category", { ascending: true })
      .order("name", { ascending: true }),
    scope.organizationId
      ? admin
          .from("organization_feature_overrides")
          .select("organization_id,feature_key,enabled,rollout_percentage,configuration,reason,updated_at")
          .eq("organization_id", scope.organizationId)
      : Promise.resolve({ data: [], error: null }),
    scope.expressionId
      ? admin
          .from("expression_feature_overrides")
          .select("organization_id,expression_id,feature_key,enabled,rollout_percentage,configuration,reason,updated_at")
          .eq("expression_id", scope.expressionId)
      : Promise.resolve({ data: [], error: null }),
    scope.groupId
      ? admin
          .from("group_feature_overrides")
          .select("organization_id,expression_id,group_id,feature_key,enabled,rollout_percentage,configuration,reason,updated_at")
          .eq("group_id", scope.groupId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (flagsResult.error || organizationResult.error || expressionResult.error || groupResult.error) {
    throw new ApiError("FEATURE_STATE_FAILED", "Unable to resolve feature availability.", 500, undefined, false);
  }

  const flags = (flagsResult.data ?? []) as FeatureFlagRow[];
  const organizationOverrides = new Map((organizationResult.data ?? []).map((item: any) => [item.feature_key, item]));
  const expressionOverrides = new Map((expressionResult.data ?? []).map((item: any) => [item.feature_key, item]));
  const groupOverrides = new Map((groupResult.data ?? []).map((item: any) => [item.feature_key, item]));
  const flagMap = new Map(flags.map((flag) => [flag.key, flag]));
  const memo = new Map<string, EffectiveFeature>();

  const resolveOne = (key: string, stack = new Set<string>()): EffectiveFeature => {
    const cached = memo.get(key);
    if (cached) return cached;
    const flag = flagMap.get(key);
    if (!flag) throw new ApiError("FEATURE_NOT_FOUND", `Feature ${key} is not configured.`, 404);
    if (stack.has(key)) throw new ApiError("FEATURE_CONFIGURATION_INVALID", "Feature parent configuration contains a cycle.", 500, undefined, false);

    const nextStack = new Set(stack);
    nextStack.add(key);

    const organizationOverride = supports(flag, "organization") ? (organizationOverrides.get(key) as OverrideRow | undefined) ?? null : null;
    const expressionOverride = supports(flag, "expression") ? (expressionOverrides.get(key) as OverrideRow | undefined) ?? null : null;
    const groupOverride = supports(flag, "group") ? (groupOverrides.get(key) as OverrideRow | undefined) ?? null : null;

    let directEnabled = flag.global_enabled === true && Number(flag.rollout_percentage ?? 100) > 0;
    let rolloutPercentage = Number(flag.rollout_percentage ?? 100);
    let inheritedFrom: EffectiveFeature["inherited_from"] = "global";
    let configuration = { ...objectValue(flag.configuration) };

    if (scope.organizationId && organizationOverride) {
      directEnabled = applyOverride(directEnabled, organizationOverride);
      rolloutPercentage = scopedRollout(rolloutPercentage, organizationOverride);
      configuration = { ...configuration, ...objectValue(organizationOverride.configuration) };
      if (organizationOverride.enabled !== null && organizationOverride.enabled !== undefined) inheritedFrom = "organization";
    }
    if (scope.expressionId && expressionOverride) {
      directEnabled = applyOverride(directEnabled, expressionOverride);
      rolloutPercentage = scopedRollout(rolloutPercentage, expressionOverride);
      configuration = { ...configuration, ...objectValue(expressionOverride.configuration) };
      if (expressionOverride.enabled !== null && expressionOverride.enabled !== undefined) inheritedFrom = "expression";
    }
    if (scope.groupId && groupOverride) {
      directEnabled = applyOverride(directEnabled, groupOverride);
      rolloutPercentage = scopedRollout(rolloutPercentage, groupOverride);
      configuration = { ...configuration, ...objectValue(groupOverride.configuration) };
      if (groupOverride.enabled !== null && groupOverride.enabled !== undefined) inheritedFrom = "group";
    }

    directEnabled = directEnabled && rolloutPercentage > 0;

    const parentKey = typeof configuration.parentKey === "string" ? configuration.parentKey.trim() : "";
    let blockedBy: string | null = null;
    let effectiveEnabled = directEnabled;
    if (parentKey) {
      const parent = resolveOne(parentKey, nextStack);
      if (!parent.effective_enabled) {
        effectiveEnabled = false;
        blockedBy = parent.key;
      }
    }

    const resolved: EffectiveFeature = {
      ...flag,
      configuration: objectValue(flag.configuration),
      organization_override: organizationOverride,
      expression_override: expressionOverride,
      group_override: groupOverride,
      direct_enabled: directEnabled,
      effective_enabled: effectiveEnabled,
      effective_rollout_percentage: rolloutPercentage,
      effective_configuration: configuration,
      inherited_from: inheritedFrom,
      blocked_by: blockedBy,
    };
    memo.set(key, resolved);
    return resolved;
  };

  return {
    scope,
    items: flags.map((flag) => resolveOne(flag.key)),
  };
}

export async function featureEnabled(admin: any, key: string, input: FeatureScopeInput = {}) {
  const state = await loadEffectiveFeatures(admin, input);
  return state.items.find((item) => item.key === key)?.effective_enabled ?? false;
}

export async function assertFeatureEnabled(
  admin: any,
  key: string,
  input: FeatureScopeInput = {},
  message?: string,
) {
  const state = await loadEffectiveFeatures(admin, input);
  const item = state.items.find((candidate) => candidate.key === key);
  if (!item?.effective_enabled) {
    throw new ApiError(
      "FEATURE_UNAVAILABLE",
      message ?? `${item?.name ?? "This feature"} is currently unavailable in this area.`,
      403,
      {
        featureKey: key,
        scope: state.scope,
        blockedBy: item?.blocked_by ?? null,
      },
    );
  }
  return item;
}
