import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createHandler } from "../_shared/handler.ts";
import { adminClient } from "../_shared/supabase.ts";
import { loadEffectiveFeatures } from "../_shared/feature-controls.ts";
import { uuid } from "../_shared/validation.ts";

Deno.serve(
  createHandler(
    { methods: ["GET"], authentication: "optional", organization: "none" },
    async ({ request }) => {
      const url = new URL(request.url);
      const organizationId = uuid(url.searchParams.get("organizationId"), "organizationId");
      const expressionId = uuid(url.searchParams.get("expressionId"), "expressionId");
      const groupId = uuid(url.searchParams.get("groupId"), "groupId");
      const requestedKeys = (url.searchParams.get("keys") ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const state = await loadEffectiveFeatures(adminClient(), {
        organizationId,
        expressionId,
        groupId,
      });

      const requested = requestedKeys.length ? new Set(requestedKeys) : null;
      const items = state.items
        .filter((item) => !requested || requested.has(item.key))
        .map((item) => ({
          key: item.key,
          name: item.name,
          category: item.category,
          effectiveEnabled: item.effective_enabled,
          directEnabled: item.direct_enabled,
          inheritedFrom: item.inherited_from,
          blockedBy: item.blocked_by,
          scopes: Array.isArray(item.effective_configuration.scopes) ? item.effective_configuration.scopes : [],
        }));

      return { data: { scope: state.scope, items } };
    },
  ),
);
