import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { adminClient } from "../_shared/supabase.ts";

async function exactCount(query: PromiseLike<{ count: number | null; error: { message?: string } | null }>, label: string) {
  const { count, error } = await query;
  if (error) throw new ApiError("PLATFORM_TELEMETRY_FAILED", `Unable to count ${label}`, 500, undefined, false);
  return count ?? 0;
}

Deno.serve(
  createHandler(
    { methods: ["GET"], authentication: "required", organization: "none" },
    async ({ auth }) => {
      if (!auth) throw new Error("Authentication context missing");
      await authorizePlatform(auth, "platform.overview.read");

      const admin = adminClient();
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [
        organizationsTotal,
        organizationsActive,
        organizationsSuspended,
        organizationsArchived,
        expressionsTotal,
        expressionsActive,
        identitiesTotal,
        membershipsActive,
        streamsLive,
        streamsScheduled,
        streamsProcessing,
        streamsFailed,
        aiRuns24h,
        aiFailures24h,
        aiRequiresReview,
        workflowsQueued,
        workflowsRunning,
        workflowsFailed,
        workflowsDeadLetter,
        deliveriesQueued,
        deliveriesRunning,
        deliveriesFailed,
        deliveriesDeadLetter,
        streamingProvidersActive,
        streamingConfigsActive,
        aiProvidersActive,
        aiModelsActive,
      ] = await Promise.all([
        exactCount(admin.from("organizations").select("id", { count: "exact", head: true }), "organizations"),
        exactCount(admin.from("organizations").select("id", { count: "exact", head: true }).eq("status", "active"), "active organizations"),
        exactCount(admin.from("organizations").select("id", { count: "exact", head: true }).eq("status", "suspended"), "suspended organizations"),
        exactCount(admin.from("organizations").select("id", { count: "exact", head: true }).eq("status", "archived"), "archived organizations"),
        exactCount(admin.from("branches").select("id", { count: "exact", head: true }), "expressions"),
        exactCount(admin.from("branches").select("id", { count: "exact", head: true }).eq("is_active", true), "active expressions"),
        exactCount(admin.from("profiles").select("id", { count: "exact", head: true }), "identities"),
        exactCount(admin.from("memberships").select("id", { count: "exact", head: true }).eq("status", "active"), "active memberships"),
        exactCount(admin.from("live_streams").select("id", { count: "exact", head: true }).eq("status", "live"), "live broadcasts"),
        exactCount(admin.from("live_streams").select("id", { count: "exact", head: true }).eq("status", "scheduled"), "scheduled broadcasts"),
        exactCount(admin.from("live_streams").select("id", { count: "exact", head: true }).in("status", ["provisioning", "ready", "processing"]), "processing broadcasts"),
        exactCount(admin.from("live_streams").select("id", { count: "exact", head: true }).eq("status", "failed"), "failed broadcasts"),
        exactCount(admin.from("ai_generation_runs").select("id", { count: "exact", head: true }).gte("created_at", since24h), "AI runs"),
        exactCount(admin.from("ai_generation_runs").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since24h), "failed AI runs"),
        exactCount(admin.from("ai_generation_runs").select("id", { count: "exact", head: true }).eq("status", "requires_review"), "AI review queue"),
        exactCount(admin.from("workflow_runs").select("id", { count: "exact", head: true }).eq("status", "queued"), "queued workflows"),
        exactCount(admin.from("workflow_runs").select("id", { count: "exact", head: true }).eq("status", "running"), "running workflows"),
        exactCount(admin.from("workflow_runs").select("id", { count: "exact", head: true }).eq("status", "failed"), "failed workflows"),
        exactCount(admin.from("workflow_runs").select("id", { count: "exact", head: true }).eq("status", "dead_letter"), "dead-letter workflows"),
        exactCount(admin.from("integration_deliveries").select("id", { count: "exact", head: true }).eq("status", "queued"), "queued integration deliveries"),
        exactCount(admin.from("integration_deliveries").select("id", { count: "exact", head: true }).eq("status", "running"), "running integration deliveries"),
        exactCount(admin.from("integration_deliveries").select("id", { count: "exact", head: true }).eq("status", "failed"), "failed integration deliveries"),
        exactCount(admin.from("integration_deliveries").select("id", { count: "exact", head: true }).eq("status", "dead_letter"), "dead-letter integration deliveries"),
        exactCount(admin.from("streaming_providers").select("id", { count: "exact", head: true }).eq("is_active", true), "streaming providers"),
        exactCount(admin.from("streaming_provider_configs").select("id", { count: "exact", head: true }).eq("is_active", true), "active streaming configurations"),
        exactCount(admin.from("ai_providers").select("id", { count: "exact", head: true }).eq("status", "active"), "AI providers"),
        exactCount(admin.from("ai_models").select("id", { count: "exact", head: true }).eq("is_active", true), "AI models"),
      ]);

      const { data: recentAudit, error: auditError } = await admin
        .from("platform_audit_log")
        .select("id,actor_profile_id,action,target_type,target_id,metadata,occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(12);
      if (auditError) throw new ApiError("PLATFORM_TELEMETRY_FAILED", "Unable to retrieve platform audit activity", 500, undefined, false);

      const queueFailures = workflowsFailed + workflowsDeadLetter + deliveriesFailed + deliveriesDeadLetter;
      const platformState = queueFailures > 0 || streamsFailed > 0 || aiFailures24h > 0 ? "attention" : "operational";

      return {
        data: {
          generatedAt: new Date().toISOString(),
          state: platformState,
          organizations: {
            total: organizationsTotal,
            active: organizationsActive,
            suspended: organizationsSuspended,
            archived: organizationsArchived,
          },
          expressions: {
            total: expressionsTotal,
            active: expressionsActive,
            inactive: Math.max(0, expressionsTotal - expressionsActive),
          },
          identities: { total: identitiesTotal, activeMemberships: membershipsActive },
          streaming: {
            live: streamsLive,
            scheduled: streamsScheduled,
            processing: streamsProcessing,
            failed: streamsFailed,
            activeProviders: streamingProvidersActive,
            activeConfigurations: streamingConfigsActive,
            configured: streamingProvidersActive > 0 && streamingConfigsActive > 0,
          },
          ai: {
            runs24h: aiRuns24h,
            failed24h: aiFailures24h,
            requiresReview: aiRequiresReview,
            activeProviders: aiProvidersActive,
            activeModels: aiModelsActive,
            configured: aiProvidersActive > 0 && aiModelsActive > 0,
          },
          jobs: {
            workflows: { queued: workflowsQueued, running: workflowsRunning, failed: workflowsFailed, deadLetter: workflowsDeadLetter },
            integrations: { queued: deliveriesQueued, running: deliveriesRunning, failed: deliveriesFailed, deadLetter: deliveriesDeadLetter },
          },
          recentAudit: recentAudit ?? [],
        },
      };
    },
  ),
);
