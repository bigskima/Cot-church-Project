import { resolveSecretValue } from '../secrets.ts';
import { aiFetch, usage } from './http.ts';
import type { AiCapability, AiProvider, AiRequest } from './types.ts';

export class AnthropicProvider implements AiProvider {
  readonly code = 'anthropic';
  supports(capability: AiCapability) { return !['transcribeAudio', 'createEmbeddings'].includes(capability); }

  private async headers(ref: string) {
    return {
      'x-api-key': await resolveSecretValue(ref),
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    };
  }

  async generateText(ref: string, r: AiRequest, s: AbortSignal) {
    const response = await aiFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: await this.headers(ref),
      body: JSON.stringify({
        model: r.model,
        system: r.system,
        max_tokens: r.maxOutputTokens ?? 1024,
        temperature: r.temperature,
        messages: [{ role: 'user', content: r.imageUrl ? [{ type: 'image', source: { type: 'url', url: r.imageUrl } }, { type: 'text', text: r.prompt }] : r.prompt }],
      }),
    }, s);
    const p = await response.json();
    return { content: p.content?.map((x: any) => x.text ?? '').join('') ?? '', providerRequestId: p.id, finishReason: p.stop_reason, ...usage(p) };
  }

  async streamText(ref: string, r: AiRequest, s: AbortSignal) {
    return aiFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: await this.headers(ref),
      body: JSON.stringify({ model: r.model, system: r.system, max_tokens: r.maxOutputTokens ?? 1024, stream: true, messages: [{ role: 'user', content: r.prompt }] }),
    }, s);
  }

  async generateStructuredData(ref: string, r: AiRequest, s: AbortSignal) {
    const result = await this.generateText(ref, { ...r, system: `${r.system ?? ''}\nReturn only valid JSON matching: ${JSON.stringify(r.jsonSchema ?? {})}` }, s);
    return { ...result, content: JSON.parse(String(result.content)) };
  }

  async transcribeAudio() { throw new Error('Anthropic does not provide transcription'); }
  async translateText(ref: string, r: AiRequest, s: AbortSignal) { return this.generateText(ref, { ...r, system: `Translate faithfully into ${r.language}. ${r.system ?? ''}` }, s); }
  async createEmbeddings() { throw new Error('Anthropic does not provide embeddings'); }
  async moderateContent(ref: string, r: AiRequest, s: AbortSignal) {
    return this.generateStructuredData(ref, { ...r, system: 'Provide a safety classification for human moderation review.', jsonSchema: { type: 'object', properties: { safe: { type: 'boolean' }, reason: { type: 'string' } } } }, s);
  }
  async analyzeImage(ref: string, r: AiRequest, s: AbortSignal) { return this.generateText(ref, r, s); }
}
