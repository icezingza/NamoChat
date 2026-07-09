// Multi-Model Router port. Every backend implements ModelProvider; the app
// only ever talks to this interface (donor-repo rule: UI never imports a
// concrete provider). Streams are abortable via AbortSignal.

export type ProviderKind =
  | 'claude'
  | 'gemini'
  | 'openai'
  | 'deepseek'
  | 'openrouter'
  | 'ollama'
  | 'lmstudio'
  | 'mock';

export interface ProviderConfig {
  kind: ProviderKind;
  apiKey?: string;
  baseUrl?: string; // required for ollama/lmstudio, optional override elsewhere
  model: string;
  temperature: number;
  maxOutputTokens: number;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  system: string; // system prompt (identity load, once-per-chat content)
  context: string; // per-turn context block (persona/memory/lore), may be ''
  history: ChatTurn[]; // prior turns, oldest first; last item is the user turn
}

export interface ChatResult {
  text: string; // full raw text (before cognitive-stream stripping)
  totalTokens?: number;
}

export interface ModelProvider {
  streamChat(
    request: ChatRequest,
    onChunk: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<ChatResult>;
  generateEmbedding?(text: string): Promise<number[]>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

// The per-turn context rides as a prefix on the final user message so it
// stays out of the (cached) system prompt and off earlier history turns.
export const foldContextIntoHistory = (request: ChatRequest): ChatTurn[] => {
  if (!request.context || request.history.length === 0) return request.history;
  const history = [...request.history];
  const last = history[history.length - 1];
  if (last.role === 'user') {
    history[history.length - 1] = {
      role: 'user',
      content: `${request.context}\n\n${last.content}`,
    };
  }
  return history;
};

// Shared SSE reader: parses `data:` lines from a fetch body stream and feeds
// each JSON payload to the handler. Handles multi-line events and [DONE].
export const readSseStream = async (
  response: Response,
  onData: (payload: unknown) => void,
): Promise<void> => {
  if (!response.body) throw new ProviderError('Provider response has no body stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '' || data === '[DONE]') continue;
      try {
        onData(JSON.parse(data));
      } catch {
        // Ignore malformed keep-alive/partial frames.
      }
    }
  }
};

export const assertOk = async (response: Response): Promise<void> => {
  if (response.ok) return;
  let detail = '';
  try {
    detail = (await response.text()).slice(0, 300);
  } catch {
    // body unreadable — status alone will have to do
  }
  throw new ProviderError(
    `Provider request failed (${response.status})${detail ? `: ${detail}` : ''}`,
    response.status,
  );
};
