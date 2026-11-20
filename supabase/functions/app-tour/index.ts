import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

const experienceSelect = "id,scope,version,title,subtitle,auto_start,is_active,updated_at";
const stepSelect = "id,step_order,target_key,route_template,title,body,icon,placement";
const progressSelect = "profile_id,experience_id,scope_key,current_step,started_at,completed_at,snoozed_until,never_remind,last_seen_at,updated_at";

type Scope = "general" | "expression";

function parseScope(value: string | null): Scope {
  if (value === "general" || value === "expression") return value;
  throw new ApiError("VALIDATION_FAILED", "Tour scope must be general or expression", 422);
}

function scopeKey(scope: Scope, expressionId: string | null) {
  if (scope === "general") return "general";
  if (!expressionId) throw new ApiError("VALIDATION_FAILED", "Expression id is required for an Expression tour", 422);
  return expressionId;
}

function present(
  experience: Record<string, unknown>,
  steps: Record<string, unknown>[],
  progress: Record<string, unknown> | null,
  eligible: boolean,
  onboardingReady: boolean,
) {
  return {
    active: true,
    eligible,
    onboardingReady,
    experience: {
      id: experience.id,
      scope: experience.scope,
      version: experience.version,
      title: experience.title,
      subtitle: experience.subtitle,
      autoStart: experience.auto_start,
      updatedAt: experience.updated_at,
    },
    steps: steps.map((step) => ({
      id: step.id,
      order: step.step_order,
      targetKey: step.target_key,
      routeTemplate: step.route_template,
      title: step.title,
      body: step.body,
      icon: step.icon,
      placement: step.placement,
    })),
    progress: progress
      ? {
          currentStep: progress.current_step ?? 0,
          startedAt: progress.started_at ?? null,
          completedAt: progress.completed_at ?? null,
          snoozedUntil: progress.snoozed_until ?? null,
          neverRemind: progress.never_remind === true,
          lastSeenAt: progress.last_seen_at ?? null,
          updatedAt: progress.updated_at ?? null,
        }
      : {
          currentStep: 0,
          startedAt: null,
          completedAt: null,
          snoozedUntil: null,
          neverRemind: false,
          lastSeenAt: null,
          updatedAt: null,
        },
  };
}

Deno.serve(
  createHandler(
    { methods: ["GET", "POST"], authentication: "required", organization: "none" },
    async ({ request, auth }) => {
      if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
      const admin = adminClient();
      const url = new URL(request.url);

      let scope: Scope;
      let expressionId: string | null = null;
      let manual = false;
      let body: Record<string, unknown> | null = null;

      if (request.method === "GET") {
        scope = parseScope(url.searchParams.get("scope"));
        const rawExpressionId = url.searchParams.get("expressionId");
        expressionId = rawExpressionId ? uuid(rawExpressionId, "expressionId", true) : null;
        manual = url.searchParams.get("manual") === "1" || url.searchParams.get("manual") === "true";
      } else {
        body = assertObject(await jsonBody(request));
        assertNoUnknownFields(body, ["action", "scope", "expressionId", "experienceId", "stepIndex", "snoozeDays"]);
        scope = parseScope(requiredString(body.scope, "scope", 20));
        const rawExpressionId = typeof body.expressionId === "string" ? body.expressionId : null;
        expressionId = rawExpressionId ? uuid(rawExpressionId, "expressionId", true) : null;
      }

      const key = scopeKey(scope, expressionId);

      if (scope === "expression") {
        const { data: membership, error: membershipError } = await admin
          .from("expression_memberships")
          .select("id")
          .eq("branch_id", expressionId!)
          .eq("profile_id", auth.user.id)
          .eq("status", "active")
          .maybeSingle();
        if (membershipError) throw new ApiError("TOUR_MEMBERSHIP_READ_FAILED", "Unable to verify Expression access", 500, undefined, false);
        if (!membership) throw new ApiError("EXPRESSION_MEMBERSHIP_REQUIRED", "Join this Expression before opening its tour", 403);
      }

      const { data: experience, error: experienceError } = await admin
        .from("app_tour_experiences")
        .select(experienceSelect)
        .eq("scope", scope)
        .eq("is_active", true)
        .maybeSingle();
      if (experienceError) throw new ApiError("TOUR_READ_FAILED", "Unable to load this app tour", 500, undefined, false);
      if (!experience) return { data: { active: false, eligible: false, onboardingReady: true, experience: null, steps: [], progress: null } };

      const { data: steps, error: stepsError } = await admin
        .from("app_tour_steps")
        .select(stepSelect)
        .eq("experience_id", experience.id)
        .order("step_order", { ascending: true });
      if (stepsError) throw new ApiError("TOUR_STEPS_READ_FAILED", "Unable to load app tour steps", 500, undefined, false);

      const loadProgress = async () => {
        const { data, error } = await admin
          .from("profile_app_tour_progress")
          .select(progressSelect)
          .eq("profile_id", auth.user.id)
          .eq("experience_id", experience.id)
          .eq("scope_key", key)
          .maybeSingle();
        if (error) throw new ApiError("TOUR_PROGRESS_READ_FAILED", "Unable to load app tour progress", 500, undefined, false);
        return data as Record<string, unknown> | null;
      };

      const onboardingReady = async () => {
        const { data: onboardingExperience, error: onboardingExperienceError } = await admin
          .from("onboarding_experiences")
          .select("id")
          .eq("audience", "member")
          .eq("is_active", true)
          .maybeSingle();
        if (onboardingExperienceError) throw new ApiError("ONBOARDING_READ_FAILED", "Unable to verify onboarding", 500, undefined, false);
        if (!onboardingExperience) return true;
        const { data: onboardingProgress, error: onboardingProgressError } = await admin
          .from("profile_onboarding_progress")
          .select("completed_at")
          .eq("profile_id", auth.user.id)
          .eq("experience_id", onboardingExperience.id)
          .maybeSingle();
        if (onboardingProgressError) throw new ApiError("ONBOARDING_PROGRESS_READ_FAILED", "Unable to verify onboarding progress", 500, undefined, false);
        return Boolean(onboardingProgress?.completed_at);
      };

      const ready = await onboardingReady();

      if (request.method === "GET") {
        const progress = await loadProgress();
        const snoozedUntil = typeof progress?.snoozed_until === "string" ? new Date(progress.snoozed_until).getTime() : 0;
        const isSnoozed = Number.isFinite(snoozedUntil) && snoozedUntil > Date.now();
        const eligible = ready && (manual || (
          experience.auto_start === true &&
          !progress?.completed_at &&
          progress?.never_remind !== true &&
          !isSnoozed
        ));
        return { data: present(experience as Record<string, unknown>, (steps ?? []) as Record<string, unknown>[], progress, eligible, ready) };
      }

      const action = requiredString(body!.action, "action", 32);
      const suppliedExperienceId = typeof body!.experienceId === "string"
        ? uuid(body!.experienceId, "experienceId", true)
        : experience.id;
      if (suppliedExperienceId !== experience.id) throw new ApiError("TOUR_VERSION_CHANGED", "A newer app tour is available", 409);
      if (!ready) throw new ApiError("ONBOARDING_REQUIRED", "Finish the COT welcome before starting the app tour", 409);

      const now = new Date();
      const nowIso = now.toISOString();
      const current = await loadProgress();
      const base = {
        profile_id: auth.user.id,
        experience_id: experience.id,
        scope_key: key,
        updated_at: nowIso,
      };

      if (action === "start" || action === "restart") {
        const restart = action === "restart";
        const { data, error } = await admin
          .from("profile_app_tour_progress")
          .upsert({
            ...base,
            current_step: restart ? 0 : Number(current?.current_step ?? 0),
            started_at: restart || !current?.started_at ? nowIso : current.started_at,
            last_seen_at: nowIso,
            completed_at: restart ? null : current?.completed_at ?? null,
            snoozed_until: restart ? null : current?.snoozed_until ?? null,
            never_remind: restart ? false : current?.never_remind === true,
          }, { onConflict: "profile_id,experience_id,scope_key" })
          .select(progressSelect)
          .single();
        if (error) throw new ApiError("TOUR_START_FAILED", "Unable to start the app tour", 500, undefined, false);
        return { data: present(experience as Record<string, unknown>, (steps ?? []) as Record<string, unknown>[], data as Record<string, unknown>, true, ready) };
      }

      if (action === "advance") {
        const stepIndex = Number(body!.stepIndex);
        if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex > Math.max(0, (steps?.length ?? 1) - 1)) {
          throw new ApiError("VALIDATION_FAILED", "Invalid app tour step", 422);
        }
        const { data, error } = await admin
          .from("profile_app_tour_progress")
          .upsert({ ...base, current_step: stepIndex, started_at: current?.started_at ?? nowIso, last_seen_at: nowIso }, { onConflict: "profile_id,experience_id,scope_key" })
          .select(progressSelect)
          .single();
        if (error) throw new ApiError("TOUR_PROGRESS_SAVE_FAILED", "Unable to save app tour progress", 500, undefined, false);
        return { data: present(experience as Record<string, unknown>, (steps ?? []) as Record<string, unknown>[], data as Record<string, unknown>, true, ready) };
      }

      if (action === "complete") {
        const { data, error } = await admin
          .from("profile_app_tour_progress")
          .upsert({ ...base, current_step: steps?.length ?? 0, started_at: current?.started_at ?? nowIso, completed_at: nowIso, snoozed_until: null, never_remind: false, last_seen_at: nowIso }, { onConflict: "profile_id,experience_id,scope_key" })
          .select(progressSelect)
          .single();
        if (error) throw new ApiError("TOUR_COMPLETE_FAILED", "Unable to complete the app tour", 500, undefined, false);
        return { data: present(experience as Record<string, unknown>, (steps ?? []) as Record<string, unknown>[], data as Record<string, unknown>, false, ready) };
      }

      if (action === "snooze") {
        const days = Number(body!.snoozeDays);
        if (!Number.isFinite(days) || days < 1 || days > 365) throw new ApiError("VALIDATION_FAILED", "Reminder days must be between 1 and 365", 422);
        const snoozedUntil = new Date(now.getTime() + Math.round(days * 24 * 60 * 60 * 1000)).toISOString();
        const { data, error } = await admin
          .from("profile_app_tour_progress")
          .upsert({ ...base, current_step: Number(current?.current_step ?? 0), started_at: current?.started_at ?? nowIso, snoozed_until: snoozedUntil, never_remind: false, last_seen_at: nowIso }, { onConflict: "profile_id,experience_id,scope_key" })
          .select(progressSelect)
          .single();
        if (error) throw new ApiError("TOUR_SNOOZE_FAILED", "Unable to save the tour reminder", 500, undefined, false);
        return { data: present(experience as Record<string, unknown>, (steps ?? []) as Record<string, unknown>[], data as Record<string, unknown>, false, ready) };
      }

      if (action === "never") {
        const { data, error } = await admin
          .from("profile_app_tour_progress")
          .upsert({ ...base, current_step: Number(current?.current_step ?? 0), started_at: current?.started_at ?? nowIso, snoozed_until: null, never_remind: true, last_seen_at: nowIso }, { onConflict: "profile_id,experience_id,scope_key" })
          .select(progressSelect)
          .single();
        if (error) throw new ApiError("TOUR_NEVER_FAILED", "Unable to save the tour preference", 500, undefined, false);
        return { data: present(experience as Record<string, unknown>, (steps ?? []) as Record<string, unknown>[], data as Record<string, unknown>, false, ready) };
      }

      throw new ApiError("VALIDATION_FAILED", "Unsupported app tour action", 422);
    },
  ),
);
