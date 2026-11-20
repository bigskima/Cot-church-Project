export type PublicChatBadge = {
  id: string;
  code: string;
  label: string;
  backgroundColor: string;
  textColor: string;
  priority: number;
  badgeVariant?: string;
};

/**
 * Resolve profile title badges inside a concrete COT scope. Global assignments
 * flow into Expression surfaces; Expression-only assignments stay scoped.
 */
export async function loadPublicChatBadges(
  admin: any,
  profileIds: string[],
  organizationId?: string | null,
  branchId?: string | null,
) {
  const result = new Map<string, PublicChatBadge[]>();
  const ids = [...new Set(profileIds.filter(Boolean))];
  if (!ids.length || !organizationId) return result;

  const { data, error } = await admin
    .from("identity_badge_assignments")
    .select("profile_id,branch_id,identity_badge_definitions!inner(id,code,label,background_color,text_color,priority,badge_variant,is_active)")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("identity_badge_definitions.is_active", true)
    .in("profile_id", ids);

  if (error) return result;

  for (const assignment of data ?? []) {
    if (branchId) {
      if (assignment.branch_id !== null && assignment.branch_id !== branchId) continue;
    } else if (assignment.branch_id !== null) {
      continue;
    }

    const definition = Array.isArray(assignment.identity_badge_definitions)
      ? assignment.identity_badge_definitions[0]
      : assignment.identity_badge_definitions;
    if (!definition) continue;

    const badge: PublicChatBadge = {
      id: definition.id,
      code: definition.code,
      label: definition.label,
      backgroundColor: definition.background_color,
      textColor: definition.text_color,
      priority: Number(definition.priority ?? 0),
      badgeVariant: definition.badge_variant ?? 'default',
    };
    const existing = result.get(assignment.profile_id) ?? [];
    if (!existing.some((item) => item.id === badge.id)) existing.push(badge);
    existing.sort((a, b) => b.priority - a.priority);
    result.set(assignment.profile_id, existing);
  }

  return result;
}
