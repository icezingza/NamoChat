// One provider covers every OpenAI-compatible backend: GPT, DeepSeek,
// OpenRouter, Ollama and LM Studio — parameterized by base URL + key.

import {
  assertOk,
  foldContextIntoHistory,
  readSseStream,
  type ChatRequest,
  type ChatResult,
  type ModelProvider,
  type ProviderConfig,
} from './types';

export class OpenAICompatibleProvider implements ModelProvider {
  constructor(
    private readonly config: ProviderConfig,
    private readonly baseUrl: string,
  ) {}

  async streamChat(
    request: ChatRequest,
    onChunk: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<ChatResult> {
    const messages = [
      { role: 'system', content: request.system },
      ...foldContextIntoHistory(request).map((turn) => ({
        role: turn.role,
        content: turn.content,
      })),
    ];

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) headers.Authorization = `Bearer ${this.config.apiKey}`;

    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxOutputTokens,
        stream: true,
      }),
    });
    await assertOk(response);

    let text = '';
    let totalTokens: number | undefined;
    await readSseStream(response, (payload) => {
      const data = payload as {
        choices?: { delta?: { content?: string } }[];
        usage?: { total_tokens?: number };
      };
      const delta = data.choices?.[0]?.delta?.content;
      if (delta) {
        text += delta;
        onChunk(delta);
      }
      if (data.usage?.total_tokens) totalTokens = data.usage.total_tokens;
    });

    return { text, totalTokens };
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!text.trim()) return [];
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) headers.Authorization = `Bearer ${this.config.apiKey}`;

    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/embeddings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
    });
    await assertOk(response);
    const data = (await response.json()) as { data?: { embedding?: number[] }[] };
    return data.data?.[0]?.embedding ?? [];
  }
}
