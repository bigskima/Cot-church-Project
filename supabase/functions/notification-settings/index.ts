import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString } from "../_shared/validation.ts";

const preferenceSelect = "email_enabled,sms_enabled,push_enabled,quiet_hours,timezone,push_preview,push_sound_enabled,updated_at";
const TIME_PATTERN = /^([01]\\d|2[0-3]):[0-5]\\d$/;
const PUSH_PREVIEWS = new Set(["full", "sender_only", "private"]);
const EXPO_PUSH_TOKEN_PATTERN = /^(?:Exponent|Expo)PushToken\\[[A-Za-z0-9_-]+\\]$/;

function normalizeQuietHours(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("VALIDATION_FAILED", "quietHours must be an object", 422);
  }
  const quiet = value as Record<string, unknown>;
  assertNoUnknownFields(quiet, ["enabled", "startTime", "endTime"]);
  if (quiet.enabled !== undefined && typeof quiet.enabled !== "boolean") {
    throw new ApiError("VALIDATION_FAILED", "quietHours.enabled must be boolean", 422);
  }
  const startTime = quiet.startTime === undefined ? "22:00" : requiredString(quiet.startTime, "quietHours.startTime", 5);
  const endTime = quiet.endTime === undefined ? "07:00" : requiredString(quiet.endTime, "quietHours.endTime", 5);
  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) {
    throw new ApiError("VALIDATION_FAILED", "Quiet hours must use 24-hour HH:MM time", 422);
  }
  return { enabled: quiet.enabled === true, startTime, endTime };
}

function normalizeTimezone(value: unknown) {
  const timezone = requiredString(value, "timezone", 80);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new ApiError("VALIDATION_FAILED", "Choose a valid timezone", 422);
  }
  return timezone;
}

function normalizePushPreview(value: unknown) {
  const preview = requiredString(value, "pushPreview", 20);
  if (!PUSH_PREVIEWS.has(preview)) {
    throw new ApiError("VALIDATION_FAILED", "pushPreview must be full, sender_only, or private", 422);
  }
  return preview;
}

function expoPushToken(value: unknown) {
  const token = requiredString(value, "expoPushToken", 255);
  if (!EXPO_PUSH_TOKEN_PATTERN.test(token)) {
    throw new ApiError("VALIDATION_FAILED", "Invalid Expo push token", 422);
  }
  return token;
}

function defaultPreferences() {
  return {
    email_enabled: true,
    sms_enabled: true,
    push_enabled: true,
    quiet_hours: {},
    timezone: "UTC",
    push_preview: "full",
    push_sound_enabled: true,
    updated_at: null,
  };
}

Deno.serve(
  createHandler(
    { methods: ["GET", "PUT", "POST", "DELETE"], authentication: "required", organization: "required" },
    async ({ request, auth }) => {
      if (!auth?.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);

      if (request.method === "GET") {
        const { data, error } = await auth.client
          .from("notification_preferences")
          .select(preferenceSelect)
          .eq("profile_id", auth.user.id)
          .eq("organization_id", auth.organizationId)
          .maybeSingle();
        if (error) throw new ApiError("PREFERENCES_READ_FAILED", "Unable to read preferences", 500, undefined, false);
        return { data: data ?? defaultPreferences() };
      }

      const body = assertObject(await jsonBody(request));
      const admin = adminClient();

      if (request.method === "POST") {
        assertNoUnknownFields(body, ["expoPushToken", "platform", "deviceName"]);
        const platform = requiredString(body.platform, "platform", 10);
        if (!["ios", "android", "web"].includes(platform)) {
          throw new ApiError("VALIDATION_FAILED", "Invalid platform", 422);
        }
        const token = expoPushToken(body.expoPushToken);
        const { data, error } = await admin
          .from("push_devices")
          .upsert(
            {
              profile_id: auth.user.id,
              expo_push_token: token,
              platform,
              device_name: optionalString(body.deviceName, "deviceName", 120),
              is_active: true,
              last_seen_at: new Date().toISOString(),
            },
            { onConflict: "expo_push_token" },
          )
          .select("id,platform,device_name,is_active,last_seen_at")
          .single();
        if (error) throw new ApiError("DEVICE_REGISTER_FAILED", "Unable to register this device for push alerts", 500, undefined, false);
        return { data, status: 201 };
      }

      if (request.method === "DELETE") {
        assertNoUnknownFields(body, ["expoPushToken"]);
        const { error } = await admin
          .from("push_devices")
          .update({ is_active: false, last_seen_at: new Date().toISOString() })
          .eq("profile_id", auth.user.id)
          .eq("expo_push_token", expoPushToken(body.expoPushToken));
        if (error) throw new ApiError("DEVICE_REMOVE_FAILED", "Unable to remove this device from push alerts", 500, undefined, false);
        return { data: { status: "deactivated" } };
      }

      assertNoUnknownFields(body, [
        "emailEnabled",
        "smsEnabled",
        "pushEnabled",
        "quietHours",
        "timezone",
        "pushPreview",
        "pushSoundEnabled",
      ]);
      for (const key of ["emailEnabled", "smsEnabled", "pushEnabled", "pushSoundEnabled"]) {
        if (body[key] !== undefined && typeof body[key] !== "boolean") {
          throw new ApiError("VALIDATION_FAILED", `${key} must be boolean`, 422);
        }
      }
      const normalizedQuietHours = body.quietHours === undefined ? undefined : normalizeQuietHours(body.quietHours);
      const normalizedTimezone = body.timezone === undefined ? undefined : normalizeTimezone(body.timezone);
      const normalizedPreview = body.pushPreview === undefined ? undefined : normalizePushPreview(body.pushPreview);

      const { data: current, error: currentError } = await auth.client
        .from("notification_preferences")
        .select(preferenceSelect)
        .eq("profile_id", auth.user.id)
        .eq("organization_id", auth.organizationId)
        .maybeSingle();
      if (currentError) throw new ApiError("PREFERENCES_READ_FAILED", "Unable to read preferences", 500, undefined, false);

      const existing = current ?? defaultPreferences();
      const values = {
        profile_id: auth.user.id,
        organization_id: auth.organizationId,
        email_enabled: body.emailEnabled ?? existing.email_enabled,
        sms_enabled: body.smsEnabled ?? existing.sms_enabled,
        push_enabled: body.pushEnabled ?? existing.push_enabled,
        quiet_hours: normalizedQuietHours ?? existing.quiet_hours,
        timezone: normalizedTimezone ?? existing.timezone,
        push_preview: normalizedPreview ?? existing.push_preview,
        push_sound_enabled: body.pushSoundEnabled ?? existing.push_sound_enabled,
      };
      const { data, error } = await auth.client
        .from("notification_preferences")
        .upsert(values, { onConflict: "profile_id,organization_id" })
        .select(preferenceSelect)
        .single();
      if (error) throw new ApiError("PREFERENCES_UPDATE_FAILED", "Unable to update preferences", 500, undefined, false);
      return { data };
    },
  ),
);
