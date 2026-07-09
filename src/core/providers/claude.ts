// Anthropic Messages API provider (browser-direct, SSE streaming).

import {
  assertOk,
  foldContextIntoHistory,
  readSseStream,
  type ChatRequest,
  type ChatResult,
  type ModelProvider,
  type ProviderConfig,
} from './types';

const DEFAULT_BASE_URL = 'https://api.anthropic.com';

export class ClaudeProvider implements ModelProvider {
  constructor(private readonly config: ProviderConfig) {}

  async streamChat(
    request: ChatRequest,
    onChunk: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<ChatResult> {
    const baseUrl = (this.config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey ?? '',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.config.model,
        system: request.system,
        messages: foldContextIntoHistory(request).map((turn) => ({
          role: turn.role,
          content: turn.content,
        })),
        temperature: this.config.temperature,
        max_tokens: this.config.maxOutputTokens,
        stream: true,
      }),
    });
    await assertOk(response);

    let text = '';
    let totalTokens: number | undefined;
    await readSseStream(response, (payload) => {
      const event = payload as {
        type?: string;
        delta?: { type?: string; text?: string };
        usage?: { output_tokens?: number };
        message?: { usage?: { input_tokens?: number; output_tokens?: number } };
      };
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        const delta = event.delta.text ?? '';
        text += delta;
        onChunk(delta);
      }
      if (event.type === 'message_delta' && event.usage?.output_tokens) {
        totalTokens = event.usage.output_tokens;
      }
    });

    return { text, totalTokens };
  }
}
