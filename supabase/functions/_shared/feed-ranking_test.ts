import { assertEquals, assertGreater } from "jsr:@std/assert@1";
import { diversifyFeed, rankFeedCandidates, type FeedSignals } from "./feed-ranking.ts";

function signals(overrides: Partial<FeedSignals> = {}): FeedSignals {
  return {
    followedOrganizationIds: new Set(), followedExpressionIds: new Set(), followedLeaderProfileIds: new Set(),
    reactedContentIds: new Set(), bookmarkedContentIds: new Set(), completedContentIds: new Set(), inProgressContentIds: new Set(),
    ...overrides,
  };
}

const now = Date.parse("2026-09-04T12:00:00Z");

Deno.test("ranking prefers recent content without identity signals", () => {
  const ranked = rankFeedCandidates([
    { key: "old", kind: "video", publishedAt: "2026-08-01T12:00:00Z" },
    { key: "new", kind: "video", publishedAt: "2026-09-04T11:00:00Z" },
  ], "org", signals(), now);
  assertEquals(ranked.map((item) => item.key), ["new", "old"]);
});

Deno.test("ranking boosts followed Expression creators", () => {
  const ranked = rankFeedCandidates([
    { key: "followed", kind: "reel", publishedAt: "2026-09-04T10:00:00Z", expressionId: "expression-a" },
    { key: "other", kind: "reel", publishedAt: "2026-09-04T11:00:00Z", expressionId: "expression-b" },
  ], "org", signals({ followedExpressionIds: new Set(["expression-a"]) }), now);
  assertEquals(ranked[0].key, "followed");
  assertEquals(ranked[0].reason, "following");
});

Deno.test("ranking prioritizes unfinished playback but demotes completed media", () => {
  const ranked = rankFeedCandidates([
    { key: "continue", kind: "video", publishedAt: "2026-09-03T12:00:00Z", contentItemId: "in-progress" },
    { key: "completed", kind: "video", publishedAt: "2026-09-04T11:00:00Z", contentItemId: "done" },
  ], "org", signals({ inProgressContentIds: new Set(["in-progress"]), completedContentIds: new Set(["done"]) }), now);
  assertEquals(ranked[0].key, "continue");
  assertEquals(ranked[0].reason, "continue");
  assertGreater(ranked[0].rank, ranked[1].rank);
});

Deno.test("ranking is stable when candidates have equal scores", () => {
  const ranked = rankFeedCandidates([
    { key: "z", kind: "post", publishedAt: null }, { key: "a", kind: "post", publishedAt: null },
  ], "org", signals(), now);
  assertEquals(ranked.map((item) => item.key), ["a", "z"]);
});

Deno.test("diversification avoids three consecutive units of one kind when alternatives exist", () => {
  const ranked = rankFeedCandidates([
    { key: "r1", kind: "reel", publishedAt: "2026-09-04T11:59:00Z" },
    { key: "r2", kind: "reel", publishedAt: "2026-09-04T11:58:00Z" },
    { key: "r3", kind: "reel", publishedAt: "2026-09-04T11:57:00Z" },
    { key: "v1", kind: "video", publishedAt: "2026-09-01T12:00:00Z" },
  ], "org", signals(), now);
  const diversified = diversifyFeed(ranked);
  assertEquals(diversified.slice(0, 3).map((item) => item.kind), ["reel", "video", "reel"]);
});

Deno.test("diversification enforces its response limit", () => {
  const ranked = rankFeedCandidates(Array.from({ length: 10 }, (_, index) => ({ key: String(index), kind: "post" as const, publishedAt: null })), "org", signals(), now);
  assertEquals(diversifyFeed(ranked, 4).length, 4);
});
