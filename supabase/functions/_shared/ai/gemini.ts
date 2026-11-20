import { resolveSecretValue } from '../secrets.ts';
import { aiFetch, usage } from './http.ts';
import type { AiCapability, AiProvider, AiRequest } from './types.ts';

export class GeminiProvider implements AiProvider {
  readonly code = 'gemini';
  supports(_: AiCapability) { return true; }

  private async url(ref: string, model: string, method = 'generateContent') {
    const key = await resolveSecretValue(ref);
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${method}?key=${encodeURIComponent(key)}`;
  }

  private body(r: AiRequest) {
    return {
      systemInstruction: r.system ? { parts: [{ text: r.system }] } : undefined,
      contents: [{ role: 'user', parts: [{ text: r.prompt }, ...(r.imageUrl ? [{ fileData: { mimeType: 'image/jpeg', fileUri: r.imageUrl } }] : [])] }],
      generationConfig: {
        temperature: r.temperature,
        maxOutputTokens: r.maxOutputTokens,
        responseMimeType: r.jsonSchema ? 'application/json' : undefined,
        responseJsonSchema: r.jsonSchema,
      },
    };
  }

  async generateText(ref: string, r: AiRequest, s: AbortSignal) {
    const response = await aiFetch(await this.url(ref, r.model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.body(r)),
    }, s);
    const p = await response.json();
    return { content: p.candidates?.[0]?.content?.parts?.map((x: any) => x.text ?? '').join('') ?? '', ...usage(p) };
  }

  async streamText(ref: string, r: AiRequest, s: AbortSignal) {
    return aiFetch(`${await this.url(ref, r.model, 'streamGenerateContent')}&alt=sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.body(r)),
    }, s);
  }

  async generateStructuredData(ref: string, r: AiRequest, s: AbortSignal) {
    const result = await this.generateText(ref, { ...r, jsonSchema: r.jsonSchema ?? { type: 'object' } }, s);
    return { ...result, content: JSON.parse(String(result.content)) };
  }

  async transcribeAudio() { throw new Error('Gemini audio upload requires a server-side file resource'); }
  async translateText(ref: string, r: AiRequest, s: AbortSignal) { return this.generateText(ref, { ...r, system: `Translate faithfully into ${r.language}. ${r.system ?? ''}` }, s); }

  async createEmbeddings(ref: string, r: AiRequest, s: AbortSignal) {
    const response = await aiFetch(await this.url(ref, r.model, 'embedContent'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { parts: [{ text: r.prompt }] } }),
    }, s);
    const p = await response.json();
    return { content: p.embedding.values };
  }

  async moderateContent(ref: string, r: AiRequest, s: AbortSignal) {
    return this.generateStructuredData(ref, {
      ...r,
      system: 'Classify safety risks. Return JSON only.',
      jsonSchema: { type: 'object', properties: { safe: { type: 'boolean' }, categories: { type: 'array', items: { type: 'string' } }, reason: { type: 'string' } }, required: ['safe', 'categories'] },
    }, s);
  }

  async analyzeImage(ref: string, r: AiRequest, s: AbortSignal) { return this.generateText(ref, r, s); }
}
