import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getNotificationWorkerSecret } from "../_shared/config.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, requiredString } from "../_shared/validation.ts";

const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";

type OutboxJob = {
  id: number;
  organization_id: string;
  announcement_id?: string | null;
  recipient_profile_id?: string | null;
  channel: string;
  payload?: Record<string, unknown> | null;
  attempts: number;
};

type PreferenceRow = {
  push_enabled?: boolean | null;
  quiet_hours?: Record<string, unknown> | null;
  timezone?: string | null;
  push_preview?: "full" | "sender_only" | "private" | string | null;
  push_sound_enabled?: boolean | null;
  urgent_platform_alerts_enabled?: boolean | null;
};

function secureEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let result = a.length ^ b.length;
  const size = Math.max(a.length, b.length, 1);
  for (let i = 0; i < size; i += 1) result |= (a[i % Math.max(a.length, 1)] ?? 0) ^ (b[i % Math.max(b.length, 1)] ?? 0);
  return result === 0;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function shortText(value: unknown, fallback = "", max = 220) {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return (text || fallback).slice(0, max);
}

function safeRoute(value: unknown) {
  const route = typeof value === "string" ? value.trim() : "";
  return route.startsWith("/") && !route.startsWith("//") ? route.slice(0, 500) : "";
}

function localMinutes(timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
    return hour * 60 + minute;
  } catch {
    return new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
  }
}

function timeMinutes(value: unknown) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function quietHoursActive(preference: PreferenceRow) {
  const quiet = record(preference.quiet_hours);
  if (quiet.enabled !== true) return false;
  const start = timeMinutes(quiet.startTime);
  const end = timeMinutes(quiet.endTime);
  if (start === null || end === null || start === end) return false;
  const now = localMinutes(shortText(preference.timezone, "UTC", 80) || "UTC");
  return start < end ? now >= start && now < end : now >= start || now < end;
}

function inferredRoute(type: string, data: Record<string, unknown>) {
  const explicit = safeRoute(data.route);
  if (explicit) return explicit;
  const branchId = typeof data.branchId === "string" ? data.branchId : "";
  const entityId = typeof data.entityId === "string" ? data.entityId : "";
  const combined = `${type} ${String(data.entityType ?? "")}`.toLowerCase();
  if (combined.includes("announcement")) return branchId ? `/expressions/${branchId}/announcements` : "/general/announcements";
  if (combined.includes("event")) return branchId
    ? (entityId ? `/expressions/${branchId}/event/${entityId}` : `/expressions/${branchId}/events`)
    : (entityId ? `/general/event/${entityId}` : "/general/events");
  if (combined.includes("prayer")) return branchId ? `/expressions/${branchId}/notifications` : "/general/notifications";
  return "/general/notifications";
}

async function authorizeWorker(request: Request, client: any) {
  const workerSecret = request.headers.get("x-worker-secret") ?? "";
  if (workerSecret) {
    try {
      if (secureEqual(workerSecret, getNotificationWorkerSecret())) return;
    } catch {
      // Cron authentication below remains available when a legacy worker secret is absent.
    }
  }

  const cronSecret = request.headers.get("x-cron-secret") ?? "";
  if (cronSecret) {
    const { data, error } = await client.rpc("verify_notification_cron_secret", { supplied: cronSecret });
    if (!error && data === true) return;
  }

  throw new ApiError("AUTHENTICATION_REQUIRED", "Worker authentication required", 401);
}

async function insertDelivery(client: any, values: {
  outboxId: number;
  status: "processing" | "delivered" | "failed";
  providerMessageId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await client.from("notification_deliveries").insert({
    outbox_id: values.outboxId,
    provider: "expo-push",
    provider_message_id: values.providerMessageId ?? null,
    status: values.status,
    response_metadata: values.metadata ?? {},
  });
}

async function deliverJob(client: any, job: OutboxJob, metadata: Record<string, unknown> = {}) {
  await client.from("notification_outbox").update({
    status: "delivered",
    delivered_at: new Date().toISOString(),
    locked_at: null,
    last_error: null,
  }).eq("id", job.id).eq("status", "processing");
  if (Object.keys(metadata).length) {
    await insertDelivery(client, { outboxId: job.id, status: "delivered", metadata });
  }
}

async function failJob(client: any, job: OutboxJob, message: string) {
  const seconds = Math.min(3600, 60 * Math.max(1, 2 ** Math.max(0, Number(job.attempts ?? 1) - 1)));
  await client.from("notification_outbox").update({
    status: "failed",
    locked_at: null,
    last_error: shortText(message, "Push delivery failed", 1000),
    available_at: new Date(Date.now() + seconds * 1000).toISOString(),
  }).eq("id", job.id).eq("status", "processing");
  await insertDelivery(client, {
    outboxId: job.id,
    status: "failed",
    metadata: { error: shortText(message, "Push delivery failed", 1000) },
  });
}

async function deferForQuietHours(client: any, job: OutboxJob) {
  await client.from("notification_outbox").update({
    status: "pending",
    locked_at: null,
    last_error: null,
    attempts: Math.max(0, Number(job.attempts ?? 1) - 1),
    available_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  }).eq("id", job.id).eq("status", "processing");
}

async function notificationContent(client: any, job: OutboxJob) {
  const payload = record(job.payload);
  const notificationId = typeof payload.notificationId === "string" ? payload.notificationId : "";
  let notification: any = null;

  if (notificationId) {
    const result = await client.from("notifications")
      .select("id,type,title,body,data")
      .eq("id", notificationId)
      .eq("recipient_profile_id", job.recipient_profile_id)
      .maybeSingle();
    notification = result.data ?? null;
  } else if (job.announcement_id && job.recipient_profile_id) {
    const result = await client.from("notifications")
      .select("id,type,title,body,data")
      .eq("announcement_id", job.announcement_id)
      .eq("recipient_profile_id", job.recipient_profile_id)
      .maybeSingle();
    notification = result.data ?? null;
  }

  if (notification) {
    const data = record(notification.data);
    return {
      notificationId: notification.id,
      type: String(notification.type ?? "notification"),
      title: shortText(notification.title, "COT"),
      body: shortText(notification.body, "Open COT to view this update."),
      data: { ...data, route: inferredRoute(String(notification.type ?? "notification"), data) },
    };
  }

  const title = shortText(payload.title, "");
  const body = shortText(payload.body, "");
  if (title || body) {
    const data = record(payload.data);
    return {
      notificationId: notificationId || null,
      type: String(payload.type ?? "notification"),
      title: title || "COT",
      body: body || "Open COT to view this update.",
      data: { ...data, route: safeRoute(data.route) || "/general/notifications" },
    };
  }

  if (job.announcement_id) {
    const result = await client.from("announcements")
      .select("id,title,body,branch_id")
      .eq("id", job.announcement_id)
      .maybeSingle();
    if (result.data) {
      const data = {
        scope: result.data.branch_id ? "expression" : "general",
        branchId: result.data.branch_id,
        entityType: "announcement",
        entityId: result.data.id,
        announcementId: result.data.id,
      };
      return {
        notificationId: null,
        type: "announcement",
        title: shortText(result.data.title, "COT announcement"),
        body: shortText(result.data.body, "A new COT announcement is available."),
        data: { ...data, route: inferredRoute("announcement", data) },
      };
    }
  }

  return null;
}

async function sendExpo(client: any, job: OutboxJob, preference: PreferenceRow) {
  if (!job.recipient_profile_id) {
    await deliverJob(client, job, { skipped: "recipient_not_scoped" });
    return { delivered: 0, skipped: 1, failed: 0 };
  }

  if (preference.push_enabled === false) {
    await deliverJob(client, job, { skipped: "push_disabled" });
    return { delivered: 0, skipped: 1, failed: 0 };
  }

  const content = await notificationContent(client, job);
  if (!content) {
    await deliverJob(client, job, { skipped: "notification_content_unavailable" });
    return { delivered: 0, skipped: 1, failed: 0 };
  }

  const urgent = content.data?.urgent === true;
  if (urgent && preference.urgent_platform_alerts_enabled === false) {
    await deliverJob(client, job, { skipped: "urgent_platform_alerts_disabled" });
    return { delivered: 0, skipped: 1, failed: 0 };
  }
  if (!urgent && quietHoursActive(preference)) {
    await deferForQuietHours(client, job);
    return { delivered: 0, skipped: 1, failed: 0, deferred: 1 };
  }

  const { data: devices, error: deviceError } = await client.from("push_devices")
      .select("id,expo_push_token,platform")
      .eq("profile_id", job.recipient_profile_id)
      .eq("is_active", true)
      .order("last_seen_at", { ascending: false })
      .limit(20);
  if (deviceError) {
    await failJob(client, job, "Unable to resolve registered push devices.");
    return { delivered: 0, skipped: 0, failed: 1 };
  }

  if (!devices?.length) {
    await deliverJob(client, job, { skipped: "no_active_device" });
    return { delivered: 0, skipped: 1, failed: 0 };
  }

  const preview = preference.push_preview === "private"
    ? { title: "COT", body: "Open COT to view your notification." }
    : preference.push_preview === "sender_only"
      ? { title: content.title, body: "Open COT to view this update." }
      : { title: content.title, body: content.body };

  const soundEnabled = preference.push_sound_enabled !== false;
  const messages = devices.map((device: any) => ({
    to: device.expo_push_token,
    title: preview.title,
    body: preview.body,
    sound: soundEnabled ? "default" : null,
    channelId: soundEnabled ? "cot-default" : "cot-silent",
    priority: urgent ? "high" : "default",
    data: {
      ...content.data,
      notificationId: content.notificationId,
      notificationType: content.type,
      organizationId: job.organization_id,
    },
  }));

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
  };
  const accessToken = Deno.env.get("EXPO_PUSH_ACCESS_TOKEN")?.trim();
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(EXPO_SEND_URL, { method: "POST", headers, body: JSON.stringify(messages) });
  } catch (error) {
    await failJob(client, job, error instanceof Error ? error.message : "Expo Push Service is unreachable.");
    return { delivered: 0, skipped: 0, failed: 1 };
  }

  let result: any = null;
  try { result = await response.json(); } catch { result = null; }
  if (!response.ok || !Array.isArray(result?.data)) {
    await failJob(client, job, `Expo push request failed (${response.status}).`);
    return { delivered: 0, skipped: 0, failed: 1 };
  }

  let accepted = 0;
  let permanentFailures = 0;
  for (let index = 0; index < devices.length; index += 1) {
    const device = devices[index];
    const ticket = result.data[index] ?? {};
    if (ticket.status === "ok" && typeof ticket.id === "string") {
      accepted += 1;
      await insertDelivery(client, {
        outboxId: job.id,
        status: "processing",
        providerMessageId: ticket.id,
        metadata: {
          pushDeviceId: device.id,
          expoPushToken: device.expo_push_token,
          notificationId: content.notificationId,
        },
      });
      continue;
    }

    const code = String(ticket?.details?.error ?? "PUSH_TICKET_ERROR");
    if (code === "DeviceNotRegistered") {
      permanentFailures += 1;
      await client.from("push_devices").update({ is_active: false }).eq("id", device.id);
    }
    await insertDelivery(client, {
      outboxId: job.id,
      status: "failed",
      metadata: {
        pushDeviceId: device.id,
        expoPushToken: device.expo_push_token,
        error: code,
        message: shortText(ticket?.message, "Expo rejected this device notification.", 600),
      },
    });
  }

  if (accepted > 0) {
    await client.from("notification_outbox").update({
      status: "delivered",
      delivered_at: new Date().toISOString(),
      locked_at: null,
      last_error: null,
    }).eq("id", job.id).eq("status", "processing");
    return { delivered: accepted, skipped: 0, failed: devices.length - accepted };
  }

  if (permanentFailures === devices.length) {
    await deliverJob(client, job, { skipped: "all_devices_unregistered" });
    return { delivered: 0, skipped: 1, failed: devices.length };
  }

  await failJob(client, job, "Expo rejected every push notification in this job.");
  return { delivered: 0, skipped: 0, failed: devices.length };
}

async function checkExpoReceipts(client: any) {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: deliveries, error } = await client.from("notification_deliveries")
    .select("id,outbox_id,provider_message_id,response_metadata,attempted_at")
    .eq("provider", "expo-push")
    .eq("status", "processing")
    .lte("attempted_at", cutoff)
    .not("provider_message_id", "is", null)
    .order("attempted_at", { ascending: true })
    .limit(500);

  if (error || !deliveries?.length) return { checked: 0, failed: 0 };

  const ids = deliveries.map((item: any) => item.provider_message_id).filter(Boolean);
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  const accessToken = Deno.env.get("EXPO_PUSH_ACCESS_TOKEN")?.trim();
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(EXPO_RECEIPTS_URL, { method: "POST", headers, body: JSON.stringify({ ids }) });
  } catch {
    return { checked: 0, failed: 0 };
  }
  if (!response.ok) return { checked: 0, failed: 0 };

  const result = await response.json().catch(() => ({}));
  const receipts = record(result?.data);
  let checked = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    const receipt = record(receipts[String(delivery.provider_message_id)]);
    if (!Object.keys(receipt).length) continue;
    checked += 1;
    const metadata = { ...record(delivery.response_metadata), receipt };
    if (receipt.status === "ok") {
      await client.from("notification_deliveries").update({ status: "delivered", response_metadata: metadata }).eq("id", delivery.id);
      continue;
    }

    failed += 1;
    await client.from("notification_deliveries").update({ status: "failed", response_metadata: metadata }).eq("id", delivery.id);
    if (String(record(receipt.details).error ?? "") === "DeviceNotRegistered") {
      const deviceId = typeof metadata.pushDeviceId === "string" ? metadata.pushDeviceId : "";
      if (deviceId) await client.from("push_devices").update({ is_active: false }).eq("id", deviceId);
    }
  }

  return { checked, failed };
}

Deno.serve(createHandler(
  { methods: ["POST"], authentication: "none", organization: "none" },
  async ({ request }) => {
    const client = adminClient();
    await authorizeWorker(request, client);

    const body = assertObject(await jsonBody(request));
    const action = requiredString(body.action, "action", 30);

    if (action === "process_push") {
      assertNoUnknownFields(body, ["action", "batchSize"]);
      const size = body.batchSize === undefined ? 50 : Number(body.batchSize);
      if (!Number.isInteger(size) || size < 1 || size > 100) {
        throw new ApiError("VALIDATION_FAILED", "batchSize must be 1-100", 422);
      }

      const receipts = await checkExpoReceipts(client);
      const { data: jobs, error } = await client.rpc("claim_notification_outbox_channel", {
        target_channel: "push",
        batch_size: size,
      });
      if (error) throw new ApiError("OUTBOX_CLAIM_FAILED", "Unable to claim push notification jobs", 500, undefined, false);

      const summary = { jobs: (jobs ?? []).length, delivered: 0, skipped: 0, failed: 0, deferred: 0, receipts };
      for (const job of jobs ?? []) {
        const { data: preference } = job.recipient_profile_id
          ? await client.from("notification_preferences")
              .select("push_enabled,quiet_hours,timezone,push_preview,push_sound_enabled,urgent_platform_alerts_enabled")
              .eq("profile_id", job.recipient_profile_id)
              .eq("organization_id", job.organization_id)
              .maybeSingle()
          : { data: null };
        const result = await sendExpo(client, job as OutboxJob, (preference ?? {}) as PreferenceRow);
        summary.delivered += result.delivered ?? 0;
        summary.skipped += result.skipped ?? 0;
        summary.failed += result.failed ?? 0;
        summary.deferred += result.deferred ?? 0;
      }
      return { data: summary };
    }

    if (action === "claim") {
      assertNoUnknownFields(body, ["action", "batchSize"]);
      const size = body.batchSize === undefined ? 50 : Number(body.batchSize);
      if (!Number.isInteger(size) || size < 1 || size > 100) throw new ApiError("VALIDATION_FAILED", "batchSize must be 1-100", 422);
      const { data, error } = await client.rpc("claim_notification_outbox", { batch_size: size });
      if (error) throw new ApiError("OUTBOX_CLAIM_FAILED", "Unable to claim notification jobs", 500, undefined, false);
      return { data: data ?? [] };
    }

    assertNoUnknownFields(body, ["action", "jobId", "provider", "providerMessageId", "error"]);
    if (!["delivered", "failed"].includes(action)) throw new ApiError("VALIDATION_FAILED", "Invalid dispatch action", 422);
    const jobId = Number(body.jobId);
    if (!Number.isInteger(jobId) || jobId < 1) throw new ApiError("VALIDATION_FAILED", "Invalid jobId", 422);
    const status = action === "delivered" ? "delivered" : "failed";
    const updates = action === "delivered"
      ? { status, delivered_at: new Date().toISOString(), locked_at: null, last_error: null }
      : {
          status,
          locked_at: null,
          last_error: requiredString(body.error, "error", 1000),
          available_at: new Date(Date.now() + 60000).toISOString(),
        };
    const { error } = await client.from("notification_outbox").update(updates).eq("id", jobId).eq("status", "processing");
    if (error) throw new ApiError("OUTBOX_ACK_FAILED", "Unable to acknowledge notification job", 500, undefined, false);
    await client.from("notification_deliveries").insert({
      outbox_id: jobId,
      provider: requiredString(body.provider, "provider", 80),
      provider_message_id: body.providerMessageId ?? null,
      status,
      response_metadata: {},
    });
    return { data: { status } };
  },
));
