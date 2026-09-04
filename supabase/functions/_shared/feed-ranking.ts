export type FeedCandidate = {
  key: string;
  kind: "post" | "reel" | "video" | "sermon" | "event";
  publishedAt: string | null;
  expressionId?: string | null;
  authorProfileId?: string | null;
  contentItemId?: string | null;
  engagementCount?: number;
};

export type FeedSignals = {
  followedOrganizationIds: Set<string>;
  followedExpressionIds: Set<string>;
  followedLeaderProfileIds: Set<string>;
  reactedContentIds: Set<string>;
  bookmarkedContentIds: Set<string>;
  completedContentIds: Set<string>;
  inProgressContentIds: Set<string>;
};

export type RankedFeedCandidate = FeedCandidate & {
  rank: number;
  reason: "following" | "continue" | "popular" | "recent";
};

const HOUR_MS = 60 * 60 * 1000;

function finiteCount(value: number | undefined) {
  return Number.isFinite(value) && value! > 0 ? value! : 0;
}

export function rankFeedCandidates(
  candidates: FeedCandidate[],
  organizationId: string,
  signals: FeedSignals,
  now = Date.now(),
): RankedFeedCandidate[] {
  return candidates.map((candidate) => {
    const published = candidate.publishedAt ? Date.parse(candidate.publishedAt) : 0;
    const ageHours = published > 0 ? Math.max(0, (now - published) / HOUR_MS) : 24 * 365;
    const recency = Math.max(0, 36 - Math.log2(ageHours + 1) * 6);
    const popularity = Math.min(18, Math.log10(finiteCount(candidate.engagementCount) + 1) * 6);
    const followsOrganization = signals.followedOrganizationIds.has(organizationId);
    const followsExpression = Boolean(candidate.expressionId && signals.followedExpressionIds.has(candidate.expressionId));
    const followsLeader = Boolean(candidate.authorProfileId && signals.followedLeaderProfileIds.has(candidate.authorProfileId));
    const contentId = candidate.contentItemId ?? "";
    const continueBoost = contentId && signals.inProgressContentIds.has(contentId) ? 22 : 0;
    const followBoost = followsLeader ? 24 : followsExpression ? 18 : followsOrganization ? 8 : 0;
    const priorInterest = contentId && (signals.reactedContentIds.has(contentId) || signals.bookmarkedContentIds.has(contentId)) ? 5 : 0;
    const completedPenalty = contentId && signals.completedContentIds.has(contentId) ? 30 : 0;
    const rank = recency + popularity + followBoost + continueBoost + priorInterest - completedPenalty;
    const reason: RankedFeedCandidate["reason"] = continueBoost ? "continue" : followBoost ? "following" : popularity >= 8 ? "popular" : "recent";
    return { ...candidate, rank: Math.round(rank * 100) / 100, reason };
  }).sort((left, right) => right.rank - left.rank || left.key.localeCompare(right.key));
}

export function diversifyFeed(candidates: RankedFeedCandidate[], limit = 80) {
  const remaining = [...candidates];
  const result: RankedFeedCandidate[] = [];
  while (remaining.length && result.length < limit) {
    const recentKinds = new Set(result.slice(-2).map((item) => item.kind));
    const nextIndex = remaining.findIndex((item) => !recentKinds.has(item.kind));
    result.push(remaining.splice(nextIndex < 0 ? 0 : nextIndex, 1)[0]);
  }
  return result;
}
