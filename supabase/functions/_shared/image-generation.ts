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

export type VisualSceneRequest = {
  useCase: string;
  source: string;
  style?: string;
  mood?: string;
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
  const promptModel = typeof configuration.promptModel === "string" && configuration.promptModel.trim()
    ? configuration.promptModel.trim()
    : "@cf/meta/llama-3.2-3b-instruct";
  return { token, accountId, model, promptModel, accountIdSecret };
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

function compactScene(value: string) {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/[“”"'\`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1300);
}

function fallbackScene(useCase: string, style = "auto", mood = "auto") {
  const base = useCase === "library_cover"
    ? "A symbolic Christian editorial still life with warm directional light, layered depth, subtle paper and fabric textures, and generous uncluttered space."
    : useCase === "sermon_artwork"
      ? "A reverent symbolic worship scene with natural light, gentle depth, a quiet focal subject, and generous uncluttered space."
      : useCase === "event_banner"
        ? "A welcoming church gathering atmosphere with people connecting naturally, soft architectural depth, warm light, and a clear uncluttered focal area."
        : useCase === "announcement_banner"
          ? "A calm contemporary church community scene with meaningful human connection, elegant natural light, and a simple uncluttered composition."
          : useCase === "form_banner"
            ? "A welcoming ministry participation scene with people engaging naturally, soft depth, clean surfaces, and generous uncluttered space."
            : useCase === "expression_banner"
              ? "A warm church community scene rooted in local belonging, natural people-focused activity, atmospheric depth, and open uncluttered space."
              : useCase === "home_banner"
                ? "A premium contemporary church community scene with cinematic natural light, subtle movement, layered depth, and broad uncluttered space."
                : "A reverent contemporary Christian visual scene with natural light, symbolic depth, and generous uncluttered space.";
  const styleHint = style === "minimal" ? " Keep the scene especially restrained and minimal." : style === "illustrated" ? " Render it as sophisticated editorial illustration." : style === "cinematic" ? " Use cinematic framing and atmospheric depth." : style === "photographic" ? " Render it as realistic editorial photography." : "";
  const moodHint = mood === "warm" ? " The emotional tone is warm and welcoming." : mood === "reflective" ? " The emotional tone is quiet and contemplative." : mood === "energetic" ? " The emotional tone is uplifting and active." : mood === "elegant" ? " The emotional tone is refined and graceful." : "";
  return base + styleHint + moodHint;
}

export async function generateVisualScene(admin: any, request: VisualSceneRequest, signal: AbortSignal): Promise<string> {
  const row = await activeProvider(admin);
  if (!row || row.code !== "cloudflare") return fallbackScene(request.useCase, request.style, request.mood);

  const config = await configuredCloudflare(admin, row);
  if (!config.accountId || !config.token) return fallbackScene(request.useCase, request.style, request.mood);

  const source = String(request.source || "").replace(/\s+/g, " ").trim().slice(0, 4500);
  if (!source) return fallbackScene(request.useCase, request.style, request.mood);

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/ai/run/${config.promptModel}`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: [
              "You are COT's visual art director.",
              "Convert ministry copy into a purely visual scene description for an image generator.",
              "Never quote, copy, spell, transliterate, or preserve any title, name, date, scripture reference, slogan, sentence, or phrase from the source.",
              "Do not describe poster design, flyer design, banners with writing, typography, lettering, words, captions, logos, signs, screens, pages, book text, or any object that invites readable writing.",
              "Describe only visible subjects, environment, lighting, composition, symbolism, activity, color atmosphere, camera/framing, and negative space.",
              "If people appear, make them natural and non-identifiable rather than specific real pastors, authors, leaders or public figures.",
              "Return only one concise scene paragraph. No headings, labels, quotation marks, lists, or explanations.",
            ].join(" "),
          },
          {
            role: "user",
            content: [
              "Content type: " + request.useCase + ".",
              request.style && request.style !== "auto" ? "Preferred visual treatment: " + request.style + "." : "",
              request.mood && request.mood !== "auto" ? "Preferred emotional tone: " + request.mood + "." : "",
              "Source ministry content (meaning only; never repeat its wording): " + source,
            ].filter(Boolean).join(" "),
          },
        ],
        max_tokens: 180,
        temperature: 0.2,
        top_p: 0.8,
      }),
      signal,
    });
    if (!response.ok) return fallbackScene(request.useCase, request.style, request.mood);
    const payload = await response.json().catch(() => null) as any;
    const candidate = payload?.result?.response ?? payload?.response ?? payload?.result ?? "";
    const scene = typeof candidate === "string" ? compactScene(candidate) : "";
    if (!scene || scene.length < 40) return fallbackScene(request.useCase, request.style, request.mood);
    return scene;
  } catch {
    return fallbackScene(request.useCase, request.style, request.mood);
  }
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
      negative_prompt: "text, typography, letters, words, alphabet characters, captions, subtitles, title text, poster text, flyer text, Bible verse text, scripture text, signage, readable signs, stage signage, screens with writing, pages with writing, book pages with text, logos, brand marks, watermarks, UI, interface elements, graphic-design layout, poster layout, flyer layout, frames, borders, distorted hands, extra fingers, grotesque, horror, gore",
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
