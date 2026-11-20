import { ApiError } from "../errors.ts";
import { resolveSecretValue } from "../secrets.ts";
import { aiFetch } from "./http.ts";
import type { AiCapability, AiProvider, AiRequest, AiResult } from "./types.ts";

const ACCOUNT_ID_REFERENCE = "CLOUDFLARE_ACCOUNT_ID";

function modelPath(model: string) {
  const value = model.trim();
  if (!/^@cf\/[A-Za-z0-9._@/-]+$/.test(value)) {
    throw new ApiError("AI_MODEL_INVALID", "Cloudflare AI model configuration is invalid", 500, undefined, false);
  }
  return value;
}

function textFromPayload(payload: any) {
  const candidate = payload?.result?.response ?? payload?.response ?? payload?.result ?? "";
  if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  throw new ApiError("AI_PROVIDER_INVALID_RESPONSE", "Cloudflare AI returned an unreadable response", 502, undefined, false);
}

export class CloudflareProvider implements AiProvider {
  readonly code = "cloudflare";

  supports(capability: AiCapability) {
    return capability === "generateText"
      || capability === "generateStructuredData"
      || capability === "translateText"
      || capability === "moderateContent";
  }

  private async endpoint(model: string) {
    const accountId = await resolveSecretValue(ACCOUNT_ID_REFERENCE);
    return `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${modelPath(model)}`;
  }

  private async headers(secretReference: string) {
    return {
      Authorization: `Bearer ${await resolveSecretValue(secretReference)}`,
      "Content-Type": "application/json",
    };
  }

  async generateText(secretReference: string, request: AiRequest, signal: AbortSignal): Promise<AiResult<string>> {
    const messages = [
      ...(request.system ? [{ role: "system", content: request.system }] : []),
      { role: "user", content: request.prompt },
    ];
    const response = await aiFetch(await this.endpoint(request.model), {
      method: "POST",
      headers: await this.headers(secretReference),
      body: JSON.stringify({
        messages,
        max_tokens: Math.max(64, Math.min(request.maxOutputTokens ?? 900, 1800)),
        temperature: request.temperature ?? 0.35,
        top_p: 0.9,
      }),
    }, signal);
    const payload = await response.json();
    return {
      content: textFromPayload(payload),
      providerRequestId: response.headers.get("cf-ray") ?? undefined,
    };
  }

  async generateStructuredData(secretReference: string, request: AiRequest, signal: AbortSignal): Promise<AiResult<Record<string, unknown>>> {
    const result = await this.generateText(secretReference, {
      ...request,
      system: `${request.system ?? ""}\nReturn only valid JSON. Do not wrap it in Markdown fences.`.trim(),
    }, signal);
    try {
      return { ...result, content: JSON.parse(result.content) as Record<string, unknown> };
    } catch {
      throw new ApiError("AI_PROVIDER_INVALID_RESPONSE", "Cloudflare AI did not return valid structured data", 502, undefined, false);
    }
  }

  async translateText(secretReference: string, request: AiRequest, signal: AbortSignal) {
    return this.generateText(secretReference, {
      ...request,
      system: `Translate faithfully into ${request.language ?? "the requested language"}. Preserve Scripture references and meaning. ${request.system ?? ""}`,
    }, signal);
  }

  async moderateContent(secretReference: string, request: AiRequest, signal: AbortSignal) {
    return this.generateStructuredData(secretReference, {
      ...request,
      system: `Classify safety risks. Return JSON with safe:boolean, categories:string[], and reason:string. ${request.system ?? ""}`,
    }, signal);
  }

  async streamText(): Promise<Response> {
    throw new ApiError("AI_CAPABILITY_UNAVAILABLE", "Cloudflare streaming is not enabled in this adapter", 501);
  }

  async transcribeAudio(): Promise<AiResult<string>> {
    throw new ApiError("AI_CAPABILITY_UNAVAILABLE", "Cloudflare audio transcription is not enabled in this adapter", 501);
  }

  async createEmbeddings(): Promise<AiResult<number[]>> {
    throw new ApiError("AI_CAPABILITY_UNAVAILABLE", "Cloudflare embeddings are not enabled in this adapter", 501);
  }

  async analyzeImage(): Promise<AiResult<string>> {
    throw new ApiError("AI_CAPABILITY_UNAVAILABLE", "Cloudflare image analysis is not enabled in this adapter", 501);
  }
}
