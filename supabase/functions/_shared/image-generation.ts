import { ApiError } from "./errors.ts";

export type ImageProviderReadiness = {
  code: string;
  name: string;
  configured: boolean;
  model: string;
  reason?: string;
};

export type GeneratedImage = {
  bytes: Uint8Array;
  contentType: string;
  providerCode: string;
  model: string;
};

export type ImageGenerationOptions = {
  width?: number;
  height?: number;
};

type ProviderRow = {
  code: string;
  name: string;
  status: string;
  secret_reference: string;
  configuration: Record<string, unknown> | null;
};

async function runtimeSecret(admin: any, name: unknown) {
  if (typeof name !== "string" || !name.trim()) return "";
  const reference = name.trim().toUpperCase();
  const environmentValue = Deno.env.get(reference)?.trim() ?? "";
  if (environmentValue) return environmentValue;
  const { data, error } = await admin.rpc("resolve_runtime_secret", { target_reference: reference });
  if (error) return "";
  return typeof data === "string" ? data.trim() : "";
}

function decodeBase64(value: string) {
  const normalized = value.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "").replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function configuredCloudflare(admin: any, row: ProviderRow) {
  const configuration = row.configuration ?? {};
  const accountIdSecret = typeof configuration.accountIdSecret === "string" ? configuration.accountIdSecret : "CLOUDFLARE_ACCOUNT_ID";
  const [token, accountId] = await Promise.all([
    runtimeSecret(admin, row.secret_reference),
    runtimeSecret(admin, accountIdSecret),
  ]);
  const model = typeof configuration.model === "string" && configuration.model.trim()
    ? configuration.model.trim()
    : "@cf/bytedance/stable-diffusion-xl-lightning";
  return { token, accountId, model, accountIdSecret };
}

async function activeProvider(admin: any): Promise<ProviderRow | null> {
  const { data, error } = await admin
    .from("cot_image_providers")
    .select("code,name,status,secret_reference,configuration")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new ApiError("IMAGE_PROVIDER_LOAD_FAILED", "Unable to inspect the image provider.", 500, undefined, false);
  return data as ProviderRow | null;
}

export async function imageProviderReadiness(admin: any): Promise<ImageProviderReadiness> {
  const row = await activeProvider(admin);
  if (!row) return { code: "", name: "No provider", configured: false, model: "", reason: "No active image provider is configured." };

  if (row.code === "cloudflare") {
    const config = await configuredCloudflare(admin, row);
    if (!config.accountId || !config.token) {
      return {
        code: row.code,
        name: row.name,
        configured: false,
        model: config.model,
        reason: `Add ${config.accountIdSecret} and ${row.secret_reference} in Platform Administration → Secure Credentials (or the hosting environment).`,
      };
    }
    return { code: row.code, name: row.name, configured: true, model: config.model };
  }

  return {
    code: row.code,
    name: row.name,
    configured: false,
    model: String(row.configuration?.model ?? ""),
    reason: `The ${row.code} image adapter is not installed yet.`,
  };
}

async function generateCloudflare(admin: any, row: ProviderRow, prompt: string, signal: AbortSignal, options: ImageGenerationOptions = {}): Promise<GeneratedImage> {
  const config = await configuredCloudflare(admin, row);
  if (!config.accountId || !config.token) {
    throw new ApiError("IMAGE_PROVIDER_NOT_CONFIGURED", "Cloudflare image generation is not configured yet. Upload an image instead, or add the Cloudflare secrets.", 503);
  }

  const configuration = row.configuration ?? {};
  const width = Number(options.width ?? configuration.width ?? 1200);
  const height = Number(options.height ?? configuration.height ?? 525);
  const steps = Math.max(1, Math.min(20, Number(configuration.steps ?? 4) || 4));
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/ai/run/${config.model}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      negative_prompt: "text, letters, words, captions, watermark, logo, UI, frame, border, distorted hands, extra fingers, grotesque, horror, gore",
      num_steps: steps,
      width: Number.isFinite(width) ? Math.max(512, Math.min(2048, Math.round(width))) : 1280,
      height: Number.isFinite(height) ? Math.max(320, Math.min(2048, Math.round(height))) : 560,
    }),
    signal,
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 240);
    throw new ApiError("IMAGE_PROVIDER_REJECTED", `Cloudflare image generation failed (${response.status}). ${detail}`, response.status === 429 ? 429 : 502, undefined, false);
  }

  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (contentType.startsWith("image/")) {
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType,
      providerCode: row.code,
      model: config.model,
    };
  }

  const payload = await response.json().catch(() => null) as any;
  const candidate = payload?.result?.image
    ?? payload?.result?.images?.[0]
    ?? payload?.result?.[0]?.image
    ?? payload?.image
    ?? payload?.data?.[0]?.b64_json
    ?? null;
  if (typeof candidate !== "string" || !candidate.trim()) {
    throw new ApiError("IMAGE_PROVIDER_INVALID_RESPONSE", "Cloudflare returned an image response COT could not read.", 502, undefined, false);
  }

  return {
    bytes: decodeBase64(candidate),
    contentType: "image/png",
    providerCode: row.code,
    model: config.model,
  };
}

export async function generateImage(admin: any, prompt: string, signal: AbortSignal, options: ImageGenerationOptions = {}): Promise<GeneratedImage> {
  const row = await activeProvider(admin);
  if (!row) throw new ApiError("IMAGE_PROVIDER_UNAVAILABLE", "No image-generation provider is active.", 503);
  if (row.code === "cloudflare") return generateCloudflare(admin, row, prompt, signal, options);
  throw new ApiError("IMAGE_PROVIDER_UNSUPPORTED", `The ${row.code} image provider is not supported by this runtime yet.`, 503);
}
