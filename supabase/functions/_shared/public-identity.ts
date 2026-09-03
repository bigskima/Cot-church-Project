import { adminClient } from "./supabase.ts";

type SocialPostRow = Record<string, any> & { author_membership_id?: string | null; branch_id?: string | null; organization_id?: string | null };

type PublicBadge = {
  id: string;
  code: string;
  label: string;
  backgroundColor: string;
  textColor: string;
  priority: number;
};

export async function enrichSocialPosts<T extends SocialPostRow>(posts: T[]): Promise<Array<T & Record<string, unknown>>> {
  if (!posts.length) return posts;
  const admin = adminClient();
  const membershipIds = [...new Set(posts.map((post) => post.author_membership_id).filter(Boolean))] as string[];
  if (!membershipIds.length) return posts;

  const { data: memberships } = await admin
    .from("memberships")
    .select("id,organization_id,branch_id,profile_id,status")
    .in("id", membershipIds);
  const activeMemberships = (memberships ?? []).filter((membership) => membership.status === "active");
  const membershipMap = new Map(activeMemberships.map((membership) => [membership.id, membership]));
  const profileIds = [...new Set(activeMemberships.map((membership) => membership.profile_id))];
  const organizationIds = [...new Set(activeMemberships.map((membership) => membership.organization_id))];
  const branchIds = [...new Set(activeMemberships.map((membership) => membership.branch_id).filter(Boolean))] as string[];

  const [profilesResult, defaultsResult, assignmentsResult, branchesResult] = await Promise.all([
    profileIds.length
      ? admin.from("profiles").select("id,display_name,username,avatar_url,bio").in("id", profileIds)
      : Promise.resolve({ data: [] as any[] }),
    organizationIds.length
      ? admin.from("identity_badge_definitions").select("id,organization_id,code,label,background_color,text_color,priority").in("organization_id", organizationIds).eq("is_membership_default", true).eq("is_active", true)
      : Promise.resolve({ data: [] as any[] }),
    profileIds.length
      ? admin.from("identity_badge_assignments").select("profile_id,branch_id,identity_badge_definitions!inner(id,code,label,background_color,text_color,priority,is_active)").in("profile_id", profileIds).eq("is_active", true).eq("identity_badge_definitions.is_active", true)
      : Promise.resolve({ data: [] as any[] }),
    branchIds.length
      ? admin.from("branches").select("id,name,code").in("id", branchIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const profileMap = new Map((profilesResult.data ?? []).map((profile: any) => [profile.id, profile]));
  const branchMap = new Map((branchesResult.data ?? []).map((branch: any) => [branch.id, branch]));
  const defaultByOrg = new Map((defaultsResult.data ?? []).map((badge: any) => [badge.organization_id, badge]));
  const assignedByProfile = new Map<string, any[]>();
  for (const assignment of assignmentsResult.data ?? []) {
    const current = assignedByProfile.get((assignment as any).profile_id) ?? [];
    current.push(assignment);
    assignedByProfile.set((assignment as any).profile_id, current);
  }

  const toBadge = (definition: any): PublicBadge => ({
    id: definition.id,
    code: definition.code,
    label: definition.label,
    backgroundColor: definition.background_color,
    textColor: definition.text_color,
    priority: Number(definition.priority ?? 0),
  });

  return posts.map((post) => {
    const membership = post.author_membership_id ? membershipMap.get(post.author_membership_id) : null;
    if (!membership) return post;
    const profile = profileMap.get(membership.profile_id);
    const badges: PublicBadge[] = [];
    const membershipDefault = defaultByOrg.get(membership.organization_id);
    if (membership.branch_id && membershipDefault) badges.push(toBadge(membershipDefault));
    for (const assignment of assignedByProfile.get(membership.profile_id) ?? []) {
      if (assignment.branch_id !== membership.branch_id) continue;
      const definition = Array.isArray(assignment.identity_badge_definitions)
        ? assignment.identity_badge_definitions[0]
        : assignment.identity_badge_definitions;
      if (definition) badges.push(toBadge(definition));
    }
    badges.sort((a, b) => b.priority - a.priority);

    return {
      ...post,
      author: profile ? {
        id: profile.id,
        displayName: profile.display_name,
        username: profile.username,
        avatarUrl: profile.avatar_url,
        bio: profile.bio,
        badges,
      } : null,
      expression: membership.branch_id ? branchMap.get(membership.branch_id) ?? null : null,
    };
  });
}
