import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const connectionStatuses = new Set(["active", "disabled", "error"]);

async function countStatus(table: string, statuses: string[]) {
  const client = adminClient();
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true })
    .in("status", statuses);
  if (error) throw new ApiError("PLATFORM_QUEUE_COUNT_FAILED", `Unable to count ${table}`, 500, undefined, false);
  return count ?? 0;
}

Deno.serve(
  createHandler(
    { methods: ["GET", "PATCH"], authentication: "required", organization: "none" },
    async ({ request, requestId, auth }) => {
      if (!auth) throw new Error("Authentication context missing");
      const admin = adminClient();

      if (request.method === "GET") {
        await authorizePlatform(auth, "platform.integrations.read");

        const [
          notifications,
          workflows,
          deliveries,
          connections,
          liveWebhooks,
          paymentWebhooks,
          notificationPending,
          notificationFailed,
          workflowQueued,
          workflowFailed,
          integrationQueued,
          integrationFailed,
        ] = await Promise.all([
          admin
            .from("notification_outbox")
            .select("id,organization_id,recipient_profile_id,channel,status,attempts,available_at,locked_at,delivered_at,last_error,created_at,organizations(id,name,slug)")
            .order("created_at", { ascending: false })
            .limit(50),
          admin
            .from("workflow_runs")
            .select("id,organization_id,workflow_definition_id,status,attempts,available_at,locked_at,started_at,completed_at,last_error,created_at,organizations(id,name,slug),workflow_definitions(id,code,name,trigger_event_type)")
            .order("created_at", { ascending: false })
            .limit(50),
          admin
            .from("integration_deliveries")
            .select("id,organization_id,connection_id,status,idempotency_key,attempts,available_at,locked_at,response_code,response_body_sha256,last_error,completed_at,created_at,organizations(id,name,slug),integration_connections(id,provider,name,status)")
            .order("created_at", { ascending: false })
            .limit(50),
          admin
            .from("integration_connections")
            .select("id,organization_id,provider,name,status,secret_reference,last_success_at,last_error_at,last_error,created_at,updated_at,organizations(id,name,slug)")
            .order("updated_at", { ascending: false })
            .limit(100),
          admin
            .from("live_webhook_events")
            .select("id,provider_id,event_type,signature_valid,received_at,processed_at,processing_error")
            .order("received_at", { ascending: false })
            .limit(30),
          admin
            .from("payment_provider_events")
            .select("id,provider,provider_event_id,event_type,signature_verified,processing_error,processed_at,received_at")
            .order("received_at", { ascending: false })
            .limit(30),
          countStatus("notification_outbox", ["pending", "processing"]),
          countStatus("notification_outbox", ["failed", "dead_letter"]),
          countStatus("workflow_runs", ["queued", "running"]),
          countStatus("workflow_runs", ["failed", "dead_letter"]),
          countStatus("integration_deliveries", ["queued", "running"]),
          countStatus("integration_deliveries", ["failed", "dead_letter"]),
        ]);

        for (const result of [notifications, workflows, deliveries, connections, liveWebhooks, paymentWebhooks]) {
          if (result.error) throw new ApiError("PLATFORM_INTEGRATIONS_FAILED", "Unable to retrieve integration runtime telemetry", 500, undefined, false);
        }

        return {
          data: {
            stats: {
              notificationPending,
              notificationFailed,
              workflowQueued,
              workflowFailed,
              integrationQueued,
              integrationFailed,
            },
            notifications: notifications.data ?? [],
            workflows: workflows.data ?? [],
            deliveries: deliveries.data ?? [],
            connections: connections.data ?? [],
            liveWebhooks: liveWebhooks.data ?? [],
            paymentWebhooks: paymentWebhooks.data ?? [],
          },
        };
      }

      await authorizePlatform(auth, "platform.integrations.manage");
      const body = assertObject(await jsonBody(request));
      const action = requiredString(body.action, "action", 48);

      if (action === "retry_job") {
        assertNoUnknownFields(body, ["action", "queue", "id", "reason"]);
        const queue = requiredString(body.queue, "queue", 32);
        const reason = requiredString(body.reason, "reason", 1000);
        const now = new Date().toISOString();

        if (queue === "notification") {
          const id = Number(body.id);
          if (!Number.isSafeInteger(id) || id < 1) throw new ApiError("VALIDATION_FAILED", "Invalid notification job id", 422);
          const { data: current } = await admin.from("notification_outbox").select("id,status,organization_id").eq("id", id).maybeSingle();
          if (!current) throw new ApiError("JOB_NOT_FOUND", "Notification job not found", 404);
          if (!new Set(["failed", "dead_letter"]).has(current.status)) throw new ApiError("JOB_NOT_RETRYABLE", "Only failed or dead-letter notification jobs can be retried", 409);
          const { data, error } = await admin
            .from("notification_outbox")
            .update({ status: "pending", available_at: now, locked_at: null, last_error: null })
            .eq("id", id)
            .select("id,status,attempts,available_at")
            .single();
          if (error) throw new ApiError("JOB_RETRY_FAILED", "Unable to retry notification job", 500, undefined, false);
          await admin.from("platform_audit_log").insert({ actor_profile_id: auth.user.id, action: "integration.notification_retry", target_type: "notification_outbox", target_id: null, request_id: requestId, metadata: { jobId: id, organizationId: current.organization_id, previousStatus: current.status, reason } });
          return { data };
        }

        if (queue === "workflow") {
          const id = uuid(requiredString(body.id, "id", 64), "id", true)!;
          const { data: current } = await admin.from("workflow_runs").select("id,status,organization_id").eq("id", id).maybeSingle();
          if (!current) throw new ApiError("JOB_NOT_FOUND", "Workflow run not found", 404);
          if (!new Set(["failed", "dead_letter"]).has(current.status)) throw new ApiError("JOB_NOT_RETRYABLE", "Only failed or dead-letter workflows can be retried", 409);
          const { data, error } = await admin
            .from("workflow_runs")
            .update({ status: "queued", available_at: now, locked_at: null, last_error: null })
            .eq("id", id)
            .select("id,status,attempts,available_at")
            .single();
          if (error) throw new ApiError("JOB_RETRY_FAILED", "Unable to retry workflow run", 500, undefined, false);
          await admin.from("platform_audit_log").insert({ actor_profile_id: auth.user.id, action: "integration.workflow_retry", target_type: "workflow_run", target_id: id, request_id: requestId, metadata: { organizationId: current.organization_id, previousStatus: current.status, reason } });
          return { data };
        }

        if (queue === "integration") {
          const id = Number(body.id);
          if (!Number.isSafeInteger(id) || id < 1) throw new ApiError("VALIDATION_FAILED", "Invalid integration delivery id", 422);
          const { data: current } = await admin.from("integration_deliveries").select("id,status,organization_id").eq("id", id).maybeSingle();
          if (!current) throw new ApiError("JOB_NOT_FOUND", "Integration delivery not found", 404);
          if (!new Set(["failed", "dead_letter"]).has(current.status)) throw new ApiError("JOB_NOT_RETRYABLE", "Only failed or dead-letter integration deliveries can be retried", 409);
          const { data, error } = await admin
            .from("integration_deliveries")
            .update({ status: "queued", available_at: now, locked_at: null, last_error: null })
            .eq("id", id)
            .select("id,status,attempts,available_at")
            .single();
          if (error) throw new ApiError("JOB_RETRY_FAILED", "Unable to retry integration delivery", 500, undefined, false);
          await admin.from("platform_audit_log").insert({ actor_profile_id: auth.user.id, action: "integration.delivery_retry", target_type: "integration_delivery", target_id: null, request_id: requestId, metadata: { deliveryId: id, organizationId: current.organization_id, previousStatus: current.status, reason } });
          return { data };
        }

        throw new ApiError("VALIDATION_FAILED", "Unsupported queue", 422);
      }

      if (action === "set_connection_status") {
        assertNoUnknownFields(body, ["action", "connectionId", "status", "reason"]);
        const connectionId = uuid(requiredString(body.connectionId, "connectionId", 64), "connectionId", true)!;
        const status = requiredString(body.status, "status", 32);
        if (!connectionStatuses.has(status)) throw new ApiError("VALIDATION_FAILED", "Invalid integration connection status", 422);
        const reason = optionalString(body.reason, "reason", 1000) ?? null;
        if (status !== "active" && !reason) throw new ApiError("VALIDATION_FAILED", "A governance reason is required when restricting a connection", 422, { reason: "Required" });

        const { data: current } = await admin
          .from("integration_connections")
          .select("id,organization_id,provider,name,status")
          .eq("id", connectionId)
          .maybeSingle();
        if (!current) throw new ApiError("CONNECTION_NOT_FOUND", "Integration connection not found", 404);

        const updates: Record<string, unknown> = { status };
        if (status === "active") updates.last_error = null;
        const { data, error } = await admin
          .from("integration_connections")
          .update(updates)
          .eq("id", connectionId)
          .select("id,organization_id,provider,name,status,last_success_at,last_error_at,last_error,updated_at")
          .single();
        if (error) throw new ApiError("CONNECTION_UPDATE_FAILED", "Unable to update integration connection", 500, undefined, false);

        await admin.from("platform_audit_log").insert({
          actor_profile_id: auth.user.id,
          action: "integration.connection_status_updated",
          target_type: "integration_connection",
          target_id: connectionId,
          request_id: requestId,
          metadata: { organizationId: current.organization_id, provider: current.provider, name: current.name, previousStatus: current.status, newStatus: status, reason },
        });
        return { data };
      }

      throw new ApiError("VALIDATION_FAILED", "Unsupported platform integration action", 422);
    },
  ),
);
