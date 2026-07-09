// Offline deterministic provider so NamoChat runs with zero configuration —
// the "graceful degradation when services are absent" rule from the donor
// repos. Streams a short in-character acknowledgement word by word.

import type { ChatRequest, ChatResult, ModelProvider } from './types';

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

export class MockProvider implements ModelProvider {
  async streamChat(
    request: ChatRequest,
    onChunk: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<ChatResult> {
    const lastUser = [...request.history].reverse().find((t) => t.role === 'user');
    const reply =
      `*smiles softly* I hear you... "${(lastUser?.content ?? '').slice(0, 80)}" — ` +
      `tell me more. (Offline mock model — configure a real provider in Settings ` +
      `to bring this character to life.)`;

    let text = '';
    for (const word of reply.split(/(?<=\s)/)) {
      await sleep(30, signal);
      text += word;
      onChunk(word);
    }
    return { text };
  }
}
