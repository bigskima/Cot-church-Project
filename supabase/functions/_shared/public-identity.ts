import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import { adminClient } from "./supabase.ts";
import { ApiError } from "./errors.ts";

type MembershipAuthoredRow = Record<string, any> & { author_membership_id?: string | null; branch_id?: string | null; organization_id?: string | null };

type PublicBadge = {
  id: string;
  code: string;
  label: string;
  backgroundColor: string;
  textColor: string;
  priority: number;
  badgeVariant?: string;
};

function nestedItem(value: any) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function enrichMembershipAuthors<T extends MembershipAuthoredRow>(rows: T[]): Promise<Array<T & Record<string, unknown>>> {
  if (!rows.length) return rows;
  const admin = adminClient();
  const membershipIds = [...new Set(rows.map((row) => row.author_membership_id).filter(Boolean))] as string[];
  const profileAuthoredIds = rows.filter((row) => !row.author_membership_id).map((row) => row.id).filter(Boolean) as string[];

  const [membershipResult, profileAuthoredResult] = await Promise.all([
    membershipIds.length
      ? admin.from("memberships").select("id,organization_id,branch_id,profile_id,status").in("id", membershipIds)
      : Promise.resolve({ data: [] as any[] }),
    profileAuthoredIds.length
      ? admin.from("content_items").select("id,author_profile_id").in("id", profileAuthoredIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const activeMemberships = (membershipResult.data ?? []).filter((membership: any) => membership.status === "active");
  const membershipMap = new Map(activeMemberships.map((membership: any) => [membership.id, membership]));
  const profileAuthorMap = new Map((profileAuthoredResult.data ?? []).map((item: any) => [item.id, item.author_profile_id]));
  const profileIds = [...new Set([
    ...activeMemberships.map((membership: any) => membership.profile_id),
    ...profileAuthorMap.values(),
  ].filter(Boolean))] as string[];
  const organizationIds = [...new Set(activeMemberships.map((membership: any) => membership.organization_id))] as string[];
  const branchIds = [...new Set(rows.map((row) => row.branch_id).filter(Boolean))] as string[];

  const [profilesResult, defaultsResult, assignmentsResult, branchesResult] = await Promise.all([
    profileIds.length
      ? admin.from("profiles").select("id,display_name,username,avatar_url,banner_url,bio").in("id", profileIds)
      : Promise.resolve({ data: [] as any[] }),
    organizationIds.length
      ? admin.from("identity_badge_definitions").select("id,organization_id,branch_id,code,label,background_color,text_color,priority,badge_variant").in("organization_id", organizationIds).eq("is_membership_default", true).eq("is_active", true)
      : Promise.resolve({ data: [] as any[] }),
    profileIds.length
      ? admin.from("identity_badge_assignments").select("organization_id,profile_id,branch_id,identity_badge_definitions!inner(id,organization_id,branch_id,code,label,background_color,text_color,priority,badge_variant,is_active)").in("profile_id", profileIds).eq("is_active", true).eq("identity_badge_definitions.is_active", true)
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
    badgeVariant: definition.badge_variant ?? 'default',
  });

  return rows.map((row) => {
    const membership: any = row.author_membership_id ? membershipMap.get(row.author_membership_id) : null;
    const profileId = membership?.profile_id ?? profileAuthorMap.get(row.id);
    const profile = profileId ? profileMap.get(profileId) : null;
    const badges: PublicBadge[] = [];
    const organizationId = membership?.organization_id ?? row.organization_id ?? null;
    if (profileId && organizationId) {
      const membershipDefault = defaultByOrg.get(organizationId);
      if (row.branch_id && membershipDefault) badges.push(toBadge(membershipDefault));
      for (const assignment of assignedByProfile.get(profileId) ?? []) {
        if (assignment.organization_id !== organizationId) continue;
        if (row.branch_id) {
          if (assignment.branch_id !== null && assignment.branch_id !== row.branch_id) continue;
        } else if (assignment.branch_id !== null) {
          continue;
        }
        const definition = Array.isArray(assignment.identity_badge_definitions) ? assignment.identity_badge_definitions[0] : assignment.identity_badge_definitions;
        if (definition) badges.push(toBadge(definition));
      }
      const seen = new Set<string>();
      badges.sort((a, b) => b.priority - a.priority);
      for (let index = badges.length - 1; index >= 0; index -= 1) {
        const badge = badges[index];
        const key = badge.id || badge.code || badge.label;
        if (seen.has(key)) badges.splice(index, 1);
        else seen.add(key);
      }
    }

    return {
      ...row,
      author: profile ? {
        id: profile.id,
        displayName: profile.display_name,
        username: profile.username,
        avatarUrl: profile.avatar_url,
        bannerUrl: profile.banner_url,
        bio: profile.bio,
        badges,
      } : null,
      expression: row.branch_id ? branchMap.get(row.branch_id) ?? null : null,
    };
  });
}

async function enrichReelReferences<T extends Record<string, any>>(rows: T[]) {
  const reelIds = [...new Set(rows.flatMap((row) => Array.isArray(row.media)
    ? row.media.filter((item: any) => item?.type === "reel_reference" && typeof item.reelId === "string").map((item: any) => item.reelId)
    : []))] as string[];
  if (!reelIds.length) return rows;

  const admin = adminClient();
  const { data: reels, error } = await admin
    .from("reels")
    .select("id,caption,media_asset_id,content_items!inner(id,visibility,status),media_assets(id,media_type,duration_seconds,source_storage_path,media_renditions(rendition_kind,storage_path),media_thumbnails(storage_path,is_primary))")
    .in("id", reelIds)
    .eq("content_items.visibility", "public")
    .eq("content_items.status", "published");
  if (error) return rows;

  const previewByReel = new Map<string, any>();
  await Promise.all((reels ?? []).map(async (reel: any) => {
    const asset = nestedItem(reel.media_assets);
    if (!asset) return;
    const renditions = Array.isArray(asset.media_renditions) ? asset.media_renditions : [];
    const thumbnails = Array.isArray(asset.media_thumbnails) ? asset.media_thumbnails : [];
    const stream = renditions.find((item: any) => item.rendition_kind === "video_stream") ?? renditions[0];
    const thumbnail = thumbnails.find((item: any) => item.is_primary) ?? thumbnails[0];
    const videoPath = stream?.storage_path ?? asset.source_storage_path ?? null;
    const thumbnailPath = thumbnail?.storage_path ?? null;

    const [videoSigned, thumbnailSigned] = await Promise.all([
      typeof videoPath === "string" && videoPath
        ? admin.storage.from("content-media").createSignedUrl(videoPath, 3600)
        : Promise.resolve({ data: null, error: null }),
      typeof thumbnailPath === "string" && thumbnailPath
        ? admin.storage.from("content-media").createSignedUrl(thumbnailPath, 3600)
        : Promise.resolve({ data: null, error: null }),
    ]);

    const videoUrl = videoSigned.error ? null : videoSigned.data?.signedUrl ?? null;
    const thumbnailUrl = thumbnailSigned.error ? null : thumbnailSigned.data?.signedUrl ?? null;
    if (!videoUrl && !thumbnailUrl) return;

    previewByReel.set(reel.id, videoUrl ? {
      id: `reel-preview-${reel.id}`,
      type: "video",
      media_type: "video",
      url: videoUrl,
      thumbnailUrl,
      duration_seconds: asset.duration_seconds ?? null,
      alt: reel.caption?.trim() || "Original COT Reel",
      quotedReelId: reel.id,
    } : {
      id: `reel-preview-${reel.id}`,
      type: "image",
      media_type: "image",
      url: thumbnailUrl,
      alt: reel.caption?.trim() || "Original COT Reel preview",
      quotedReelId: reel.id,
    });
  }));

  return rows.map((row) => {
    if (!Array.isArray(row.media)) return row;
    const media: any[] = [];
    for (const item of row.media) {
      media.push(item);
      if (item?.type !== "reel_reference" || typeof item.reelId !== "string") continue;
      const preview = previewByReel.get(item.reelId);
      if (preview) media.push(preview);
    }
    return { ...row, media };
  });
}

export async function enrichSocialPosts<T extends MembershipAuthoredRow>(rows: T[]) {
  const authored = await enrichMembershipAuthors(rows);
  return enrichReelReferences(authored);
}
export const enrichSocialComments = enrichMembershipAuthors;

function nestedContentItem(value: any) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function enrichContentCreators<T extends { content_items?: any }>(rows: T[], client: SupabaseClient) {
  if (!rows.length) return rows;
  const admin = adminClient();
  const items = rows.map((row) => nestedContentItem(row.content_items)).filter(Boolean);
  const profileIds = [...new Set(items.map((item) => item.author_profile_id).filter(Boolean))] as string[];
  const expressionIds = [...new Set(items.map((item) => item.expression_id).filter(Boolean))] as string[];
  const organizationIds = [...new Set(items.map((item) => item.organization_id).filter(Boolean))] as string[];
  const contentIds = [...new Set(items.map((item) => item.id).filter(Boolean))] as string[];

  const [profilesResult, expressionsResult, organizationsResult, engagementResult] = await Promise.all([
    profileIds.length
      ? admin.from("profiles").select("id,display_name,username,avatar_url,banner_url").in("id", profileIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    expressionIds.length
      ? admin.from("branches").select("id,name,code,is_active").in("id", expressionIds).eq("is_active", true)
      : Promise.resolve({ data: [] as any[], error: null }),
    organizationIds.length
      ? admin.from("organizations").select("id,name,status").in("id", organizationIds).eq("status", "active")
      : Promise.resolve({ data: [] as any[], error: null }),
    // Media counters are legacy snapshots. Read canonical totals through the
    // same RLS client as the feed, without downloading every reaction/comment.
    contentIds.length
      ? client.from("content_items").select("id,content_reactions(count),content_comments(count)")
          .in("id", contentIds).eq("content_comments.is_hidden", false)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);
  if (engagementResult.error) throw new ApiError("MEDIA_ENGAGEMENT_FAILED", "Unable to retrieve media engagement", 500, undefined, false);

  const profileMap = new Map((profilesResult.data ?? []).map((profile: any) => [profile.id, profile]));
  const expressionMap = new Map((expressionsResult.data ?? []).map((expression: any) => [expression.id, expression]));
  const organizationMap = new Map((organizationsResult.data ?? []).map((organization: any) => [organization.id, organization]));
  const engagementMap = new Map((engagementResult.data ?? []).map((item: any) => [item.id, item]));

  return rows.map((row) => {
    const item = nestedContentItem(row.content_items);
    if (!item) return row;
    const author = item.author_profile_id ? profileMap.get(item.author_profile_id) ?? null : null;
    const expression = item.expression_id ? expressionMap.get(item.expression_id) ?? null : null;
    const organization = item.organization_id ? organizationMap.get(item.organization_id) ?? null : null;
    const engagement = engagementMap.get(item.id);
    return {
      ...row,
      likes_count: engagement?.content_reactions?.[0]?.count ?? 0,
      comments_count: engagement?.content_comments?.[0]?.count ?? 0,
      content_items: {
        ...item,
        author: author ? {
          id: author.id,
          display_name: author.display_name,
          username: author.username,
          avatar_url: author.avatar_url,
          banner_url: author.banner_url,
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
