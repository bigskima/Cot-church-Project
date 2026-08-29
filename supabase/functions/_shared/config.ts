import { ApiError } from "./errors.ts";

function required(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new ApiError("SERVER_MISCONFIGURED", `Missing ${name}`, 500, undefined, false);
  return value;
}

export function getPublicSupabaseConfig() {
  return {
    url: required("SUPABASE_URL"),
    anonKey: required("SUPABASE_ANON_KEY"),
  };
}

export function getServiceRoleKey() {
  return required("SUPABASE_SERVICE_ROLE_KEY");
}

export function getAllowedOrigins() {
  return (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getPasswordRecoveryRedirectUrl() {
  return required("PASSWORD_RECOVERY_REDIRECT_URL");
}

export function getNotificationWorkerSecret() {
  return required("NOTIFICATION_WORKER_SECRET");
}

export function getRateLimitPepper() {
  return required("RATE_LIMIT_PEPPER");
}
<<<<<<< ours
<<<<<<< ours
=======
=======
>>>>>>> theirs

export function getPaymentWebhookSecret() {
  return required("PAYMENT_WEBHOOK_SECRET");
}

export function getWorkflowWorkerSecret() {
  return required("WORKFLOW_WORKER_SECRET");
}
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
