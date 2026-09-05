import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import { adminClient } from "./supabase.ts";

type MembershipAuthoredRow = Record<string, any> & { author_membership_id?: string | null; branch_id?: string | null; organization_id?: string | null };

type PublicBadge = {
  id: string;
  code: string;
  label: string;
  backgroundColor: string;
  textColor: string;
  priority: number;
};

async function enrichMembershipAuthors<T extends MembershipAuthoredRow>(rows: T[]): Promise<Array<T & Record<string, unknown>>> {
  if (!rows.length) return rows;
  const admin = adminClient();
  const membershipIds = [...new Set(rows.map((row) => row.author_membership_id).filter(Boolean))] as string[];
  if (!membershipIds.length) return rows;

  const { data: memberships } = await admin.from("memberships").select("id,organization_id,branch_id,profile_id,status").in("id", membershipIds);
  const activeMemberships = (memberships ?? []).filter((membership) => membership.status === "active");
  const membershipMap = new Map(activeMemberships.map((membership) => [membership.id, membership]));
  const profileIds = [...new Set(activeMemberships.map((membership) => membership.profile_id))];
  const organizationIds = [...new Set(activeMemberships.map((membership) => membership.organization_id))];
  const branchIds = [...new Set(rows.map((row) => row.branch_id).filter(Boolean))] as string[];

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

  return rows.map((row) => {
    const membership = row.author_membership_id ? membershipMap.get(row.author_membership_id) : null;
    if (!membership) return row;
    const profile = profileMap.get(membership.profile_id);
    const badges: PublicBadge[] = [];
    const membershipDefault = defaultByOrg.get(membership.organization_id);
    if (row.branch_id && membershipDefault) badges.push(toBadge(membershipDefault));
    for (const assignment of assignedByProfile.get(membership.profile_id) ?? []) {
      if (assignment.branch_id !== row.branch_id) continue;
      const definition = Array.isArray(assignment.identity_badge_definitions) ? assignment.identity_badge_definitions[0] : assignment.identity_badge_definitions;
      if (definition) badges.push(toBadge(definition));
    }
    badges.sort((a, b) => b.priority - a.priority);

    return {
      ...row,
      author: profile ? {
        id: profile.id,
        displayName: profile.display_name,
        username: profile.username,
        avatarUrl: profile.avatar_url,
        bio: profile.bio,
        badges,
      } : null,
      expression: row.branch_id ? branchMap.get(row.branch_id) ?? null : null,
    };
  });
}

export const enrichSocialPosts = enrichMembershipAuthors;
export const enrichSocialComments = enrichMembershipAuthors;

function nestedContentItem(value: any) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function enrichContentCreators<T extends { content_items?: any }>(rows: T[]) {
  if (!rows.length) return rows;
  const admin = adminClient();
  const items = rows.map((row) => nestedContentItem(row.content_items)).filter(Boolean);
  const profileIds = [...new Set(items.map((item) => item.author_profile_id).filter(Boolean))] as string[];
  const expressionIds = [...new Set(items.map((item) => item.expression_id).filter(Boolean))] as string[];
  const organizationIds = [...new Set(items.map((item) => item.organization_id).filter(Boolean))] as string[];

  const [profilesResult, expressionsResult, organizationsResult] = await Promise.all([
    profileIds.length
      ? admin.from("profiles").select("id,display_name,username,avatar_url").in("id", profileIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    expressionIds.length
      ? admin.from("branches").select("id,name,code,is_active").in("id", expressionIds).eq("is_active", true)
      : Promise.resolve({ data: [] as any[], error: null }),
    organizationIds.length
      ? admin.from("organizations").select("id,name,status").in("id", organizationIds).eq("status", "active")
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  const profileMap = new Map((profilesResult.data ?? []).map((profile: any) => [profile.id, profile]));
  const expressionMap = new Map((expressionsResult.data ?? []).map((expression: any) => [expression.id, expression]));
  const organizationMap = new Map((organizationsResult.data ?? []).map((organization: any) => [organization.id, organization]));

  return rows.map((row) => {
    const item = nestedContentItem(row.content_items);
    if (!item) return row;
    const author = item.author_profile_id ? profileMap.get(item.author_profile_id) ?? null : null;
    const expression = item.expression_id ? expressionMap.get(item.expression_id) ?? null : null;
    const organization = item.organization_id ? organizationMap.get(item.organization_id) ?? null : null;
    return {
      ...row,
      content_items: {
        ...item,
        author: author ? {
          id: author.id,
          display_name: author.display_name,
          username: author.username,
          avatar_url: author.avatar_url,
        } : null,
        expression: expression ? {
          id: expression.id,
          name: expression.name,
          code: expression.code,
        } : null,
        organization: organization ? {
          id: organization.id,
          name: organization.name,
        } : null,
      },
    };
  });
}


export async function enrichContentEngagement<T extends { id: string }>(
  rows: T[],
  client: SupabaseClient,
  viewerProfileId?: string | null,
): Promise<Array<T & {
  likes_count: number;
  comments_count: number;
  viewer_reaction: string | null;
  viewer_bookmarked: boolean;
  social_reactions: Array<{ reaction: string }>;
}>> {
  if (!rows.length) return [];
  const contentIds = [...new Set(rows.map((row) => row.id).filter(Boolean))];

  const [reactionsResult, commentsResult, bookmarksResult] = await Promise.all([
    client
      .from("content_reactions")
      .select("content_item_id,profile_id,reaction")
      .in("content_item_id", contentIds),
    client
      .from("content_comments")
      .select("id,content_item_id")
      .in("content_item_id", contentIds)
      .eq("is_hidden", false),
    viewerProfileId
      ? client
          .from("content_bookmarks")
          .select("content_item_id")
          .eq("profile_id", viewerProfileId)
          .in("content_item_id", contentIds)
      : Promise.resolve({ data: [] as Array<{ content_item_id: string }>, error: null }),
  ]);

  const reactionsByContent = new Map<string, Array<{ profile_id: string; reaction: string }>>();
  if (!reactionsResult.error) {
    for (const row of reactionsResult.data ?? []) {
      const current = reactionsByContent.get(row.content_item_id) ?? [];
      current.push({ profile_id: row.profile_id, reaction: row.reaction });
      reactionsByContent.set(row.content_item_id, current);
    }
  }

  const commentsByContent = new Map<string, number>();
  if (!commentsResult.error) {
    for (const row of commentsResult.data ?? []) {
      commentsByContent.set(row.content_item_id, (commentsByContent.get(row.content_item_id) ?? 0) + 1);
    }
  }

  const bookmarked = new Set(
    bookmarksResult.error ? [] : (bookmarksResult.data ?? []).map((row) => row.content_item_id),
  );

  return rows.map((row) => {
    const reactions = reactionsByContent.get(row.id) ?? [];
    const viewerReaction = viewerProfileId
      ? reactions.find((reaction) => reaction.profile_id === viewerProfileId)?.reaction ?? null
      : null;

    return {
      ...row,
      likes_count: reactions.length,
      comments_count: commentsByContent.get(row.id) ?? 0,
      viewer_reaction: viewerReaction,
      viewer_bookmarked: bookmarked.has(row.id),
      social_reactions: reactions.map(({ reaction }) => ({ reaction })),
    };
  });
}
