import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { adminClient } from "../_shared/supabase.ts";
import { uuid } from "../_shared/validation.ts";

async function onlinePaymentAvailable(organizationId: string) {
  const admin = adminClient();
  const { data: routes, error: routeError } = await admin
    .from("payment_routing_rules")
    .select("id,provider_id,payment_providers!inner(status)")
    .eq("is_active", true)
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .limit(20);
  if (routeError || !routes?.length) return false;

  const activeProviderIds = routes
    .filter((route: any) => route.payment_providers?.status === "active")
    .map((route: any) => route.provider_id);
  if (!activeProviderIds.length) return false;

  const { count, error: configError } = await admin
    .from("payment_provider_configs")
    .select("id", { count: "exact", head: true })
    .in("provider_id", activeProviderIds)
    .eq("is_active", true)
    .or(`organization_id.eq.${organizationId},organization_id.is.null`);
  return !configError && (count ?? 0) > 0;
}

Deno.serve(
  createHandler(
    { methods: ["GET"], authentication: "none", organization: "none" },
    async ({ request }) => {
      const url = new URL(request.url);
      const organizationParam = url.searchParams.get("organizationId");
      if (!organizationParam) {
        throw new ApiError("ORGANIZATION_REQUIRED", "Church organization is required for giving", 422);
      }
      const organizationId = uuid(organizationParam, "organizationId", true)!;
      const expressionParam = url.searchParams.get("expressionId");
      const expressionId = expressionParam ? uuid(expressionParam, "expressionId", true)! : null;
      const admin = adminClient();

      const { data: organization, error: organizationError } = await admin
        .from("organizations")
        .select("id,name,status")
        .eq("id", organizationId)
        .maybeSingle();
      if (organizationError || !organization || organization.status !== "active") {
        throw new ApiError("GIVING_SCOPE_UNAVAILABLE", "Giving is unavailable for this church", 404);
      }

      let expression: { id: string; name: string; is_active: boolean } | null = null;
      if (expressionId) {
        const { data, error } = await admin
          .from("branches")
          .select("id,name,is_active")
          .eq("id", expressionId)
          .eq("organization_id", organizationId)
          .maybeSingle();
        if (error || !data || !data.is_active) {
          throw new ApiError("GIVING_SCOPE_UNAVAILABLE", "Giving is unavailable for this expression", 404);
        }
        expression = data;
      }

      let settingsQuery = admin.from("giving_settings").select("*").eq("organization_id", organizationId);
      let purposesQuery = admin
        .from("giving_purposes")
        .select("id,organization_id,branch_id,name,description,status,display_order,is_default")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      let accountsQuery = admin
        .from("organization_bank_accounts")
        .select("id,organization_id,branch_id,label,bank_name,account_name,account_number,routing_number,swift_code,iban,currency,transfer_instructions,additional_instructions,reference_prefix,is_public,is_active,display_order")
        .eq("organization_id", organizationId)
        .eq("is_public", true)
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      let campaignsQuery = admin
        .from("giving_campaigns")
        .select("id,organization_id,branch_id,name,description,currency,goal_amount_minor,status,starts_at,ends_at")
        .eq("organization_id", organizationId)
        .in("status", ["active", "completed"])
        .order("created_at", { ascending: false });

      if (expressionId) {
        settingsQuery = settingsQuery.eq("branch_id", expressionId);
        purposesQuery = purposesQuery.eq("branch_id", expressionId);
        accountsQuery = accountsQuery.eq("branch_id", expressionId);
        campaignsQuery = campaignsQuery.eq("branch_id", expressionId);
      } else {
        settingsQuery = settingsQuery.is("branch_id", null);
        purposesQuery = purposesQuery.is("branch_id", null);
        accountsQuery = accountsQuery.is("branch_id", null);
        campaignsQuery = campaignsQuery.is("branch_id", null);
      }

      const [settingsResult, purposesResult, accountsResult, campaignsResult] = await Promise.all([
        settingsQuery.maybeSingle(),
        purposesQuery,
        accountsQuery,
        campaignsQuery,
      ]);
      for (const result of [settingsResult, purposesResult, accountsResult, campaignsResult]) {
        if (result.error) {
          throw new ApiError("GIVING_LOAD_FAILED", "Unable to retrieve giving information", 500, undefined, false);
        }
      }

      const settings = settingsResult.data;
      const accounts = accountsResult.data ?? [];
      const providerReady = settings?.online_payment_enabled ? await onlinePaymentAvailable(organizationId) : false;
      const manualAvailable = Boolean(settings?.is_enabled && settings.manual_transfer_enabled && accounts.length > 0);
      const onlineAvailable = Boolean(settings?.is_enabled && settings.online_payment_enabled && providerReady);

      return {
        data: {
          scope: expressionId ? "expression" : "church",
          organization: { id: organization.id, name: organization.name },
          expression: expression ? { id: expression.id, name: expression.name } : null,
          settings: settings
            ? {
                id: settings.id,
                displayTitle: settings.display_title,
                displaySubtitle: settings.display_subtitle,
                isEnabled: settings.is_enabled,
                manualTransferEnabled: settings.manual_transfer_enabled,
                onlinePaymentEnabled: settings.online_payment_enabled,
                onlineUnavailableMessage: settings.online_unavailable_message,
              }
            : null,
          purposes: purposesResult.data ?? [],
          campaigns: campaignsResult.data ?? [],
          bankAccounts: accounts,
          currencies: [...new Set(accounts.map((account: any) => account.currency))],
          methods: {
            manualBankTransfer: manualAvailable,
            onlinePayment: onlineAvailable,
          },
        },
      };
    },
  ),
);
