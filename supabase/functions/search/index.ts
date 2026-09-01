import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { publicClient } from "../_shared/supabase.ts";
import { uuid } from "../_shared/validation.ts";

export interface SearchResultItem {
  id: string;
  type: 'sermon' | 'video' | 'reel' | 'event' | 'campus' | 'leader';
  title: string;
  subtitle?: string;
  thumbnailUrl?: string | null;
  expressionId?: string | null;
  destination: string;
}

Deno.serve(createHandler(
  { methods: ["GET"], authentication: "optional", organization: "optional" },
  async ({ request, auth }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim();
    if (!query) {
      return { data: [] };
    }

    const orgParam = url.searchParams.get("organizationId");
    const organizationId = orgParam ? uuid(orgParam, "organizationId", true) : (auth?.organizationId ?? null);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "30", 10), 50);

    const client = publicClient();
    const searchPattern = `%${query}%`;
    const results: SearchResultItem[] = [];

    // 1. Search Sermons
    try {
      let sermonQuery = client
        .from("sermons")
        .select("id, title, preacher, scripture_references, created_at, content_items!inner(visibility, status)")
        .or(`title.ilike.${searchPattern},preacher.ilike.${searchPattern}`)
        .eq("content_items.status", "published")
        .limit(10);

      if (organizationId) sermonQuery = sermonQuery.eq("organization_id", organizationId);
      if (!auth) sermonQuery = sermonQuery.eq("content_items.visibility", "public");

      const { data: sermons } = await sermonQuery;
      if (sermons) {
        for (const s of sermons) {
          results.push({
            id: s.id,
            type: 'sermon',
            title: s.title,
            subtitle: s.preacher ? `Teaching by ${s.preacher}` : 'Sermon',
            destination: `/sermon/${s.id}`,
          });
        }
      }
    } catch {
      // Ignore individual search domain failures
    }

    // 2. Search Videos
    try {
      let videoQuery = client
        .from("videos")
        .select("id, title, category, created_at, content_items!inner(visibility, status)")
        .or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`)
        .eq("content_items.status", "published")
        .limit(10);

      if (organizationId) videoQuery = videoQuery.eq("organization_id", organizationId);
      if (!auth) videoQuery = videoQuery.eq("content_items.visibility", "public");

      const { data: videos } = await videoQuery;
      if (videos) {
        for (const v of videos) {
          results.push({
            id: v.id,
            type: 'video',
            title: v.title,
            subtitle: v.category ? `Video · ${v.category}` : 'Watch Video',
            destination: `/watch/${v.id}`,
          });
        }
      }
    } catch {
      // Ignore
    }

    // 3. Search Events
    try {
      let eventQuery = client
        .from("events")
        .select("id, title, location, starts_at, visibility")
        .ilike("title", searchPattern)
        .limit(5);

      if (organizationId) eventQuery = eventQuery.eq("organization_id", organizationId);
      if (!auth) eventQuery = eventQuery.eq("visibility", "public");

      const { data: events } = await eventQuery;
      if (events) {
        for (const e of events) {
          results.push({
            id: e.id,
            type: 'event',
            title: e.title,
            subtitle: e.starts_at ? new Date(e.starts_at).toLocaleDateString() : 'Gathering',
            destination: `/event/${e.id}`,
          });
        }
      }
    } catch {
      // Ignore
    }

    // 4. Search Campus Expressions
    try {
      let branchQuery = client
        .from("branches")
        .select("id, name, code")
        .or(`name.ilike.${searchPattern},code.ilike.${searchPattern}`)
        .limit(5);

      if (organizationId) branchQuery = branchQuery.eq("organization_id", organizationId);

      const { data: branches } = await branchQuery;
      if (branches) {
        for (const b of branches) {
          results.push({
            id: b.id,
            type: 'campus',
            title: b.name,
            subtitle: `Campus Expression · ${b.code}`,
            destination: `/expression/${b.id}`,
          });
        }
      }
    } catch {
      // Ignore
    }

    return { data: results.slice(0, limit) };
  }
));
