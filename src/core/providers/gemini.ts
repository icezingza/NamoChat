// Google Gemini provider via the REST streamGenerateContent SSE endpoint —
// no SDK dependency, same fetch/SSE pattern as the other providers.

import {
  assertOk,
  foldContextIntoHistory,
  readSseStream,
  type ChatRequest,
  type ChatResult,
  type ModelProvider,
  type ProviderConfig,
} from './types';

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiProvider implements ModelProvider {
  constructor(private readonly config: ProviderConfig) {}

  async streamChat(
    request: ChatRequest,
    onChunk: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<ChatResult> {
    const baseUrl = (this.config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    const url =
      `${baseUrl}/models/${this.config.model}:streamGenerateContent?alt=sse` +
      `&key=${encodeURIComponent(this.config.apiKey ?? '')}`;

    const response = await fetch(url, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents: foldContextIntoHistory(request).map((turn) => ({
          role: turn.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: turn.content }],
        })),
        generationConfig: {
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxOutputTokens,
        },
      }),
    });
    await assertOk(response);

    let text = '';
    let totalTokens: number | undefined;
    await readSseStream(response, (payload) => {
      const data = payload as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: { totalTokenCount?: number };
      };
      const delta = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      if (delta) {
        text += delta;
        onChunk(delta);
      }
      if (data.usageMetadata?.totalTokenCount) totalTokens = data.usageMetadata.totalTokenCount;
    });

    return { text, totalTokens };
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!text.trim()) return [];
    const baseUrl = (this.config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    const response = await fetch(
      `${baseUrl}/models/text-embedding-004:embedContent?key=${encodeURIComponent(this.config.apiKey ?? '')}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { parts: [{ text }] } }),
      },
    );
    await assertOk(response);
    const data = (await response.json()) as { embedding?: { values?: number[] } };
    return data.embedding?.values ?? [];
  }
}
