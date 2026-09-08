import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import { ApiError } from "./errors.ts";

export type SafetyProfileSets = {
  mutedTargets: Set<string>;
  blockedProfiles: Set<string>;
  hiddenFromFeed: Set<string>;
};

export async function loadSafetyProfileSets(
  admin: SupabaseClient,
  viewerProfileId?: string | null,
): Promise<SafetyProfileSets> {
  if (!viewerProfileId) {
    return {
      mutedTargets: new Set(),
      blockedProfiles: new Set(),
      hiddenFromFeed: new Set(),
    };
  }

  const [ownedResult, inboundBlocksResult] = await Promise.all([
    admin
      .from("profile_safety_relationships")
      .select("target_profile_id,mode")
      .eq("owner_profile_id", viewerProfileId),
    admin
      .from("profile_safety_relationships")
      .select("owner_profile_id")
      .eq("target_profile_id", viewerProfileId)
      .eq("mode", "block"),
  ]);

  if (ownedResult.error || inboundBlocksResult.error) {
    throw new ApiError("SAFETY_CONTEXT_FAILED", "Unable to apply your safety preferences", 500, undefined, false);
  }

  const mutedTargets = new Set<string>();
  const blockedProfiles = new Set<string>();

  for (const row of ownedResult.data ?? []) {
    if (row.mode === "mute") mutedTargets.add(row.target_profile_id);
    if (row.mode === "block") blockedProfiles.add(row.target_profile_id);
  }
  for (const row of inboundBlocksResult.data ?? []) {
    blockedProfiles.add(row.owner_profile_id);
  }

  return {
    mutedTargets,
    blockedProfiles,
    hiddenFromFeed: new Set([...mutedTargets, ...blockedProfiles]),
  };
}

export async function assertProfilesMayInteract(
  admin: SupabaseClient,
  actorProfileId: string,
  targetProfileId?: string | null,
) {
  if (!targetProfileId || targetProfileId === actorProfileId) return;

  const { data, error } = await admin
    .from("profile_safety_relationships")
    .select("owner_profile_id,target_profile_id")
    .eq("mode", "block")
    .in("owner_profile_id", [actorProfileId, targetProfileId])
    .in("target_profile_id", [actorProfileId, targetProfileId])
    .limit(1);

  if (error) {
    throw new ApiError("SAFETY_CONTEXT_FAILED", "Unable to verify interaction safety", 500, undefined, false);
  }
  if ((data ?? []).length) {
    throw new ApiError("INTERACTION_BLOCKED", "This interaction is unavailable", 403);
  }
}

export function filterByAuthor<T>(
  rows: T[],
  hiddenProfileIds: Set<string>,
  authorProfileId: (row: T) => string | null | undefined,
) {
  if (!hiddenProfileIds.size) return rows;
  return rows.filter((row) => {
    const authorId = authorProfileId(row);
    return !authorId || !hiddenProfileIds.has(authorId);
  });
}
