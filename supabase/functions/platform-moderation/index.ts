import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const postingModes = new Set(["open", "closed", "allowlist"]);
const reportStatuses = new Set(["pending", "under_review", "actioned", "dismissed"]);

type PostingMode = "open" | "closed" | "allowlist";

function trimmed(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function preview(value: unknown, max = 180) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

Deno.serve(
  createHandler(
    { methods: ["GET", "PATCH", "DELETE"], authentication: "required", organization: "none" },
    async ({ request, requestId, auth }) => {
      if (!auth?.user) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
      const admin = adminClient();

      const loadPostingState = async () => {
        const [{ data: policy, error: policyError }, { data: exemptions, error: exemptionsError }] = await Promise.all([
          admin
            .from("platform_public_posting_policy")
            .select("policy_key,mode,reason,updated_by,updated_at")
            .eq("policy_key", "general")
            .maybeSingle(),
          admin
            .from("platform_public_posting_exemptions")
            .select("profile_id,reason,granted_by,created_at,updated_at")
            .order("created_at", { ascending: false })
            .limit(500),
        ]);

        if (policyError || exemptionsError) {
          throw new ApiError("MODERATION_STATE_FAILED", "Unable to load public posting controls", 500, undefined, false);
        }

        const profileIds = (exemptions ?? []).map((item) => item.profile_id).filter(Boolean);
        const { data: profiles, error: profilesError } = profileIds.length
          ? await admin
              .from("profiles")
              .select("id,display_name,username,avatar_url,phone_number")
              .in("id", profileIds)
          : { data: [], error: null };

        if (profilesError) {
          throw new ApiError("MODERATION_STATE_FAILED", "Unable to load approved account details", 500, undefined, false);
        }

        const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
        return {
          policy: {
            mode: (policy?.mode ?? "open") as PostingMode,
            reason: policy?.reason ?? "",
            updatedBy: policy?.updated_by ?? null,
            updatedAt: policy?.updated_at ?? null,
          },
          exemptions: (exemptions ?? []).map((item) => {
            const profile = profileMap.get(item.profile_id) as any;
            return {
              profileId: item.profile_id,
              reason: item.reason ?? "",
              grantedBy: item.granted_by ?? null,
              createdAt: item.created_at,
              updatedAt: item.updated_at,
              displayName: profile?.display_name ?? null,
              username: profile?.username ?? null,
              avatarUrl: profile?.avatar_url ?? null,
              phoneNumber: profile?.phone_number ?? null,
            };
          }),
        };
      };

      const enrichContent = async (rows: any[]) => {
        if (!rows.length) return [];
        const ids = rows.map((row) => row.id);
        const profileIds = [...new Set(rows.map((row) => row.author_profile_id).filter(Boolean))];
        const expressionIds = [...new Set(rows.map((row) => row.expression_id).filter(Boolean))];

        const [postsRes, reelsRes, videosRes, sermonsRes, profilesRes, branchesRes, reportsRes] = await Promise.all([
          admin.from("social_posts").select("id,body,media,status").in("id", ids),
          admin.from("reels").select("id,caption,media_asset_id").in("id", ids),
          admin.from("videos").select("id,title,description,media_asset_id").in("id", ids),
          admin.from("sermons").select("content_item_id,title,preacher,description").in("content_item_id", ids),
          profileIds.length
            ? admin.from("profiles").select("id,display_name,username,avatar_url").in("id", profileIds)
            : Promise.resolve({ data: [], error: null } as any),
          expressionIds.length
            ? admin.from("branches").select("id,name,code,is_active,deleted_at").in("id", expressionIds)
            : Promise.resolve({ data: [], error: null } as any),
          admin.from("content_moderation_reports")
            .select("content_item_id,status")
            .in("content_item_id", ids)
            .in("status", ["pending", "under_review"]),
        ]);

        const failed = [postsRes, reelsRes, videosRes, sermonsRes, profilesRes, branchesRes, reportsRes].find((result) => result.error);
        if (failed?.error) throw new ApiError("MODERATION_CONTENT_FAILED", "Unable to load moderation content details", 500, undefined, false);

        const postMap = new Map((postsRes.data ?? []).map((item: any) => [item.id, item]));
        const reelMap = new Map((reelsRes.data ?? []).map((item: any) => [item.id, item]));
        const videoMap = new Map((videosRes.data ?? []).map((item: any) => [item.id, item]));
        const sermonMap = new Map((sermonsRes.data ?? []).map((item: any) => [item.content_item_id, item]));
        const profileMap = new Map((profilesRes.data ?? []).map((item: any) => [item.id, item]));
        const branchMap = new Map((branchesRes.data ?? []).map((item: any) => [item.id, item]));
        const reportCount = new Map<string, number>();
        for (const report of reportsRes.data ?? []) {
          if (!report.content_item_id) continue;
          reportCount.set(report.content_item_id, (reportCount.get(report.content_item_id) ?? 0) + 1);
        }

        return rows.map((row) => {
          const post: any = postMap.get(row.id);
          const reel: any = reelMap.get(row.id);
          const video: any = videoMap.get(row.id);
          const sermon: any = sermonMap.get(row.id);
          const author: any = row.author_profile_id ? profileMap.get(row.author_profile_id) : null;
          const expression: any = row.expression_id ? branchMap.get(row.expression_id) : null;

          let title = row.content_type === "post" ? "Community post" : row.content_type;
          let summary = "";
          if (post) summary = preview(post.body);
          if (reel) {
            title = "Reel";
            summary = preview(reel.caption);
          }
          if (video) {
            title = video.title || "Video";
            summary = preview(video.description);
          }
          if (sermon) {
            title = sermon.title || "Sermon";
            summary = preview(sermon.description || sermon.preacher);
          }

          return {
            ...row,
            displayTitle: title,
            preview: summary,
            author: author
              ? { id: author.id, displayName: author.display_name, username: author.username, avatarUrl: author.avatar_url }
              : null,
            expression: expression
              ? { id: expression.id, name: expression.name, code: expression.code, isActive: expression.is_active, deletedAt: expression.deleted_at }
              : null,
            openReportCount: reportCount.get(row.id) ?? 0,
          };
        });
      };

      const loadReports = async (url: URL) => {
        const status = url.searchParams.get("status")?.trim() ?? "open";
        const page = Math.max(1, Number(url.searchParams.get("page") || "1") || 1);
        const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || "50") || 50));
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = admin
          .from("content_moderation_reports")
          .select("id,organization_id,expression_id,content_item_id,comment_id,reporter_profile_id,reason,details,status,action_taken,reviewed_by,created_at,updated_at", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(from, to);

        if (status === "open") query = query.in("status", ["pending", "under_review"]);
        else if (reportStatuses.has(status)) query = query.eq("status", status);
        else if (status !== "all") throw new ApiError("VALIDATION_FAILED", "Invalid moderation report status", 422);

        const { data: reports, error, count } = await query;
        if (error) throw new ApiError("MODERATION_REPORTS_FAILED", "Unable to load moderation reports", 500, undefined, false);

        const contentIds = [...new Set((reports ?? []).map((item) => item.content_item_id).filter(Boolean))] as string[];
        const commentIds = [...new Set((reports ?? []).map((item) => item.comment_id).filter(Boolean))] as string[];
        const profileIds = [...new Set((reports ?? []).flatMap((item) => [item.reporter_profile_id, item.reviewed_by]).filter(Boolean))] as string[];

        const [contentRes, commentsRes, profilesRes] = await Promise.all([
          contentIds.length
            ? admin.from("content_items").select("id,organization_id,expression_id,author_profile_id,content_type,visibility,status,published_at,created_at").in("id", contentIds)
            : Promise.resolve({ data: [], error: null } as any),
          commentIds.length
            ? admin.from("content_comments").select("id,content_item_id,author_profile_id,parent_comment_id,body,is_hidden,created_at").in("id", commentIds)
            : Promise.resolve({ data: [], error: null } as any),
          profileIds.length
            ? admin.from("profiles").select("id,display_name,username,avatar_url").in("id", profileIds)
            : Promise.resolve({ data: [], error: null } as any),
        ]);
        if (contentRes.error || commentsRes.error || profilesRes.error) {
          throw new ApiError("MODERATION_REPORTS_FAILED", "Unable to load moderation report context", 500, undefined, false);
        }

        const enrichedContent = await enrichContent(contentRes.data ?? []);
        const contentMap = new Map(enrichedContent.map((item: any) => [item.id, item]));
        const commentMap = new Map((commentsRes.data ?? []).map((item: any) => [item.id, item]));
        const profileMap = new Map((profilesRes.data ?? []).map((item: any) => [item.id, item]));

        return {
          items: (reports ?? []).map((report) => ({
            ...report,
            content: report.content_item_id ? contentMap.get(report.content_item_id) ?? null : null,
            comment: report.comment_id ? commentMap.get(report.comment_id) ?? null : null,
            reporter: profileMap.get(report.reporter_profile_id) ?? null,
            reviewer: report.reviewed_by ? profileMap.get(report.reviewed_by) ?? null : null,
          })),
          page,
          pageSize,
          total: count ?? 0,
        };
      };

      const loadContent = async (url: URL) => {
        const scope = url.searchParams.get("scope")?.trim() ?? "all";
        const contentType = url.searchParams.get("type")?.trim() ?? "all";
        const status = url.searchParams.get("status")?.trim() ?? "all";
        const q = trimmed(url.searchParams.get("q")).toLowerCase();
        const pageSize = Math.min(200, Math.max(20, Number(url.searchParams.get("pageSize") || "100") || 100));

        let query = admin
          .from("content_items")
          .select("id,organization_id,expression_id,author_profile_id,content_type,visibility,status,published_at,created_at")
          .order("created_at", { ascending: false })
          .limit(pageSize);

        if (scope === "general") query = query.is("expression_id", null);
        else if (scope === "expression") query = query.not("expression_id", "is", null);
        else if (scope !== "all") throw new ApiError("VALIDATION_FAILED", "Invalid content scope", 422);

        if (contentType !== "all") query = query.eq("content_type", contentType);
        if (status !== "all") query = query.eq("status", status);

        if (/^[0-9a-f-]{36}$/i.test(q)) query = query.eq("id", q);

        const { data, error } = await query;
        if (error) throw new ApiError("MODERATION_CONTENT_FAILED", "Unable to load platform content", 500, undefined, false);
        let items = await enrichContent(data ?? []);

        if (q && !/^[0-9a-f-]{36}$/i.test(q)) {
          items = items.filter((item: any) => {
            const haystack = [
              item.displayTitle,
              item.preview,
              item.author?.displayName,
              item.author?.username,
              item.expression?.name,
              item.expression?.code,
            ].filter(Boolean).join(" ").toLowerCase();
            return haystack.includes(q);
          });
        }

        return { items, total: items.length };
      };

      const processStorageCleanup = async (deletionId: string) => {
        const { data: tasks, error: taskError } = await admin
          .from("platform_storage_cleanup_tasks")
          .select("id,bucket,storage_path,status,attempts")
          .eq("deletion_id", deletionId)
          .in("status", ["pending", "failed"])
          .order("created_at", { ascending: true });
        if (taskError) throw new ApiError("STORAGE_CLEANUP_FAILED", "Unable to load pending Storage cleanup", 500, undefined, false);

        const grouped = new Map<string, any[]>();
        for (const task of tasks ?? []) {
          const list = grouped.get(task.bucket) ?? [];
          list.push(task);
          grouped.set(task.bucket, list);
        }

        for (const [bucket, bucketTasks] of grouped) {
          const paths = bucketTasks.map((task) => task.storage_path);
          const { error: removeError } = await admin.storage.from(bucket).remove(paths);
          const ids = bucketTasks.map((task) => task.id);
          if (removeError) {
            await admin.from("platform_storage_cleanup_tasks")
              .update({
                status: "failed",
                attempts: Math.max(...bucketTasks.map((task) => Number(task.attempts ?? 0))) + 1,
                last_error: String(removeError.message ?? "Storage cleanup failed").slice(0, 1000),
              })
              .in("id", ids);
          } else {
            await admin.from("platform_storage_cleanup_tasks")
              .update({ status: "complete", attempts: Math.max(...bucketTasks.map((task) => Number(task.attempts ?? 0))) + 1, last_error: null })
              .in("id", ids);
          }
        }

        const { data: finalTasks, error: finalError } = await admin
          .from("platform_storage_cleanup_tasks")
          .select("status")
          .eq("deletion_id", deletionId);
        if (finalError) throw new ApiError("STORAGE_CLEANUP_FAILED", "Unable to verify Storage cleanup", 500, undefined, false);

        const total = finalTasks?.length ?? 0;
        const complete = (finalTasks ?? []).filter((task) => task.status === "complete").length;
        const failed = (finalTasks ?? []).filter((task) => task.status === "failed").length;
        const cleanupStatus = total === 0 ? "not_required" : failed === 0 ? "complete" : complete > 0 ? "partial" : "failed";

        await admin.from("platform_moderation_deletions")
          .update({
            storage_cleanup_status: cleanupStatus,
            completed_at: cleanupStatus === "complete" || cleanupStatus === "not_required" ? new Date().toISOString() : null,
          })
          .eq("id", deletionId);

        return { total, complete, failed, status: cleanupStatus };
      };

      if (request.method === "GET") {
        await authorizePlatform(auth, "platform.moderation.read");
        const url = new URL(request.url);
        const view = url.searchParams.get("view")?.trim() ?? "posting";

        if (view === "posting") return { data: await loadPostingState() };
        if (view === "reports") return { data: await loadReports(url) };
        if (view === "content") return { data: await loadContent(url) };
        if (view === "deletions") {
          const { data, error } = await admin
            .from("platform_moderation_deletions")
            .select("id,target_type,target_id,organization_id,expression_id,actor_profile_id,reason,storage_cleanup_status,created_at,completed_at")
            .order("created_at", { ascending: false })
            .limit(100);
          if (error) throw new ApiError("MODERATION_HISTORY_FAILED", "Unable to load deletion history", 500, undefined, false);
          return { data: { items: data ?? [] } };
        }
        throw new ApiError("VALIDATION_FAILED", "Unsupported moderation view", 422);
      }

      await authorizePlatform(auth, "platform.moderation.manage");
      const body = assertObject(await jsonBody(request));
      const action = requiredString(body.action, "action", 50);

      if (request.method === "DELETE") {
        if (action === "remove_content") {
          assertNoUnknownFields(body, ["action", "contentId", "reason"]);
          const contentId = uuid(requiredString(body.contentId, "contentId", 64), "contentId", true)!;
          const reason = requiredString(body.reason, "reason", 1000);
          const { data, error } = await admin.rpc("platform_remove_content", {
            target_content_id: contentId,
            actor_profile_id: auth.user.id,
            deletion_reason: reason,
            audit_request_id: requestId,
          });
          if (error) {
            if (error.code === "P0002") throw new ApiError("CONTENT_NOT_FOUND", error.message, 404);
            if (error.code === "22023" || error.code === "23514") throw new ApiError("VALIDATION_FAILED", error.message, 422);
            throw new ApiError("CONTENT_DELETE_FAILED", "Unable to remove this content", 500, undefined, false);
          }
          const cleanup = data?.deletionId ? await processStorageCleanup(String(data.deletionId)) : null;
          return { data: { ...data, cleanup } };
        }

        if (action === "remove_comment") {
          assertNoUnknownFields(body, ["action", "commentId", "reason"]);
          const commentId = uuid(requiredString(body.commentId, "commentId", 64), "commentId", true)!;
          const reason = requiredString(body.reason, "reason", 1000);
          const { data, error } = await admin.rpc("platform_remove_comment", {
            target_comment_id: commentId,
            actor_profile_id: auth.user.id,
            deletion_reason: reason,
            audit_request_id: requestId,
          });
          if (error) {
            if (error.code === "P0002") throw new ApiError("COMMENT_NOT_FOUND", error.message, 404);
            if (error.code === "22023" || error.code === "23514") throw new ApiError("VALIDATION_FAILED", error.message, 422);
            throw new ApiError("COMMENT_DELETE_FAILED", "Unable to remove this comment", 500, undefined, false);
          }
          return { data };
        }

        throw new ApiError("VALIDATION_FAILED", "Unsupported destructive moderation action", 422);
      }

      if (action === "set_public_posting_policy") {
        assertNoUnknownFields(body, ["action", "mode", "reason"]);
        const mode = requiredString(body.mode, "mode", 20) as PostingMode;
        if (!postingModes.has(mode)) throw new ApiError("VALIDATION_FAILED", "Choose a valid public posting mode", 422);

        const reason = optionalString(body.reason, "reason", 1000) ?? "";
        if (mode !== "open" && reason.trim().length < 3) {
          throw new ApiError("VALIDATION_FAILED", "Add a short reason before restricting public posting", 422, { reason: "Required" });
        }

        const { data: previous, error: previousError } = await admin
          .from("platform_public_posting_policy")
          .select("mode,reason")
          .eq("policy_key", "general")
          .maybeSingle();
        if (previousError) throw new ApiError("MODERATION_UPDATE_FAILED", "Unable to read the current posting policy", 500, undefined, false);

        const { error: updateError } = await admin
          .from("platform_public_posting_policy")
          .upsert({
            policy_key: "general",
            mode,
            reason: reason.trim(),
            updated_by: auth.user.id,
          }, { onConflict: "policy_key" });
        if (updateError) throw new ApiError("MODERATION_UPDATE_FAILED", "Unable to update public posting policy", 500, undefined, false);

        const { error: auditError } = await admin.from("platform_audit_log").insert({
          actor_profile_id: auth.user.id,
          action: "moderation.public_posting_policy_changed",
          target_type: "platform_policy",
          target_id: "general-public-posting",
          request_id: requestId,
          metadata: {
            previousMode: previous?.mode ?? "open",
            newMode: mode,
            previousReason: previous?.reason ?? "",
            reason: reason.trim(),
          },
        });
        if (auditError) throw new ApiError("PLATFORM_AUDIT_FAILED", "Posting policy changed but the audit record could not be written", 500, undefined, false);

        return { data: await loadPostingState() };
      }

      if (action === "add_public_posting_exemption") {
        assertNoUnknownFields(body, ["action", "profileId", "reason"]);
        const profileId = uuid(requiredString(body.profileId, "profileId", 64), "profileId", true)!;
        const reason = optionalString(body.reason, "reason", 1000) ?? "";

        const { data: profile, error: profileError } = await admin
          .from("profiles")
          .select("id")
          .eq("id", profileId)
          .maybeSingle();
        if (profileError || !profile) throw new ApiError("PROFILE_NOT_FOUND", "Account not found", 404);

        const { error: upsertError } = await admin
          .from("platform_public_posting_exemptions")
          .upsert({
            profile_id: profileId,
            reason: reason.trim(),
            granted_by: auth.user.id,
          }, { onConflict: "profile_id" });
        if (upsertError) throw new ApiError("MODERATION_UPDATE_FAILED", "Unable to approve this account for public posting", 500, undefined, false);

        const { error: auditError } = await admin.from("platform_audit_log").insert({
          actor_profile_id: auth.user.id,
          action: "moderation.public_posting_exemption_added",
          target_type: "identity",
          target_id: profileId,
          request_id: requestId,
          metadata: { reason: reason.trim() },
        });
        if (auditError) throw new ApiError("PLATFORM_AUDIT_FAILED", "Account approval changed but the audit record could not be written", 500, undefined, false);

        return { data: await loadPostingState() };
      }

      if (action === "remove_public_posting_exemption") {
        assertNoUnknownFields(body, ["action", "profileId"]);
        const profileId = uuid(requiredString(body.profileId, "profileId", 64), "profileId", true)!;

        const { error: deleteError } = await admin
          .from("platform_public_posting_exemptions")
          .delete()
          .eq("profile_id", profileId);
        if (deleteError) throw new ApiError("MODERATION_UPDATE_FAILED", "Unable to remove this public posting approval", 500, undefined, false);

        const { error: auditError } = await admin.from("platform_audit_log").insert({
          actor_profile_id: auth.user.id,
          action: "moderation.public_posting_exemption_removed",
          target_type: "identity",
          target_id: profileId,
          request_id: requestId,
          metadata: {},
        });
        if (auditError) throw new ApiError("PLATFORM_AUDIT_FAILED", "Account approval changed but the audit record could not be written", 500, undefined, false);

        return { data: await loadPostingState() };
      }

      if (action === "resolve_report") {
        assertNoUnknownFields(body, ["action", "reportId", "decision", "note"]);
        const reportId = uuid(requiredString(body.reportId, "reportId", 64), "reportId", true)!;
        const decision = requiredString(body.decision, "decision", 30);
        const note = optionalString(body.note, "note", 1000) ?? null;
        const { data, error } = await admin.rpc("platform_resolve_content_report", {
          target_report_id: reportId,
          actor_profile_id: auth.user.id,
          decision,
          resolution_note: note,
          audit_request_id: requestId,
        });
        if (error) {
          if (error.code === "P0002") throw new ApiError("REPORT_NOT_FOUND", error.message, 404);
          if (error.code === "22023" || error.code === "23514") throw new ApiError("VALIDATION_FAILED", error.message, 422);
          throw new ApiError("REPORT_RESOLUTION_FAILED", "Unable to resolve moderation report", 500, undefined, false);
        }
        return { data };
      }

      if (action === "retry_storage_cleanup") {
        assertNoUnknownFields(body, ["action", "deletionId"]);
        const deletionId = uuid(requiredString(body.deletionId, "deletionId", 64), "deletionId", true)!;
        return { data: { deletionId, cleanup: await processStorageCleanup(deletionId) } };
      }

      throw new ApiError("VALIDATION_FAILED", "Unsupported moderation action", 422);
    },
  ),
);
