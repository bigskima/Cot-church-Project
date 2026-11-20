import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

const experienceSelect = "id,version,policy_version,title,subtitle,policy_title,policy_summary,policy_points,is_active,updated_at";
const progressSelect = "profile_id,experience_id,policy_accepted_at,completed_at,updated_at";

function present(experience: Record<string, unknown>, progress: Record<string, unknown> | null) {
  return {
    active: true,
    experience: {
      id: experience.id,
      version: experience.version,
      policyVersion: experience.policy_version,
      title: experience.title,
      subtitle: experience.subtitle,
      policyTitle: experience.policy_title,
      policySummary: experience.policy_summary,
      policyPoints: Array.isArray(experience.policy_points) ? experience.policy_points : [],
      updatedAt: experience.updated_at,
    },
    progress: progress
      ? {
          policyAcceptedAt: progress.policy_accepted_at ?? null,
          completedAt: progress.completed_at ?? null,
          updatedAt: progress.updated_at ?? null,
        }
      : {
          policyAcceptedAt: null,
          completedAt: null,
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

      const { data: experience, error: experienceError } = await admin
        .from("onboarding_experiences")
        .select(experienceSelect)
        .eq("audience", "member")
        .eq("is_active", true)
        .maybeSingle();

      if (experienceError) throw new ApiError("ONBOARDING_READ_FAILED", "Unable to load onboarding", 500, undefined, false);
      if (!experience) return { data: { active: false, experience: null, progress: null } };

      const loadProgress = async () => {
        const { data, error } = await admin
          .from("profile_onboarding_progress")
          .select(progressSelect)
          .eq("profile_id", auth.user.id)
          .eq("experience_id", experience.id)
          .maybeSingle();
        if (error) throw new ApiError("ONBOARDING_PROGRESS_READ_FAILED", "Unable to load onboarding progress", 500, undefined, false);
        return data as Record<string, unknown> | null;
      };

      if (request.method === "GET") {
        return { data: present(experience as Record<string, unknown>, await loadProgress()) };
      }

      const body = assertObject(await jsonBody(request));
      assertNoUnknownFields(body, ["action", "experienceId"]);
      const action = requiredString(body.action, "action", 32);
      const experienceId = uuid(requiredString(body.experienceId, "experienceId", 36), "experienceId", true)!;
      if (experienceId !== experience.id) {
        throw new ApiError("ONBOARDING_VERSION_CHANGED", "A newer onboarding version is available", 409);
      }

      if (action === "accept_policy") {
        const now = new Date().toISOString();
        const { data, error } = await admin
          .from("profile_onboarding_progress")
          .upsert(
            {
              profile_id: auth.user.id,
              experience_id: experience.id,
              policy_accepted_at: now,
              updated_at: now,
            },
            { onConflict: "profile_id,experience_id" },
          )
          .select(progressSelect)
          .single();
        if (error) throw new ApiError("ONBOARDING_ACCEPT_FAILED", "Unable to save policy acknowledgement", 500, undefined, false);
        return { data: present(experience as Record<string, unknown>, data as Record<string, unknown>) };
      }

      if (action === "complete") {
        const progress = await loadProgress();
        if (!progress?.policy_accepted_at) {
          throw new ApiError("POLICY_ACCEPTANCE_REQUIRED", "Accept the community policy before completing onboarding", 409);
        }
        const now = new Date().toISOString();
        const { data, error } = await admin
          .from("profile_onboarding_progress")
          .update({ completed_at: now, updated_at: now })
          .eq("profile_id", auth.user.id)
          .eq("experience_id", experience.id)
          .select(progressSelect)
          .single();
        if (error) throw new ApiError("ONBOARDING_COMPLETE_FAILED", "Unable to complete onboarding", 500, undefined, false);
        return { data: present(experience as Record<string, unknown>, data as Record<string, unknown>) };
      }

      throw new ApiError("VALIDATION_FAILED", "Unsupported onboarding action", 422);
    },
  ),
);
