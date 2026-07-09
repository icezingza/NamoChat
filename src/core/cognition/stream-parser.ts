// Ported pattern from darknamo-nexus-3 core/cognition/StreamParser.ts:
// an incremental parser that strips a leading <cognitive_stream>…</cognitive_stream>
// block from a streamed reply so it never reaches the chat UI. Tolerates the
// block being absent, malformed, split across chunks, or truncated.

const OPEN_TAG = '<cognitive_stream>';
const CLOSE_TAG = '</cognitive_stream>';

export interface ParsedChunk {
  visibleText: string;
  cognitiveStream?: string;
}

type ParserPhase = 'detecting' | 'capturing' | 'passthrough';

export class CognitiveStreamParser {
  private phase: ParserPhase = 'detecting';
  private buffer = '';
  private captured = '';

  processChunk(chunk: string): ParsedChunk {
    if (this.phase === 'passthrough') return { visibleText: chunk };

    this.buffer += chunk;

    if (this.phase === 'detecting') {
      const trimmed = this.buffer.trimStart();
      if (trimmed.startsWith(OPEN_TAG)) {
        this.phase = 'capturing';
        this.buffer = trimmed.slice(OPEN_TAG.length);
      } else if (OPEN_TAG.startsWith(trimmed) || trimmed === '') {
        // Could still become the open tag — keep buffering.
        return { visibleText: '' };
      } else {
        // Ordinary text: switch to zero-buffer passthrough.
        this.phase = 'passthrough';
        const visibleText = this.buffer;
        this.buffer = '';
        return { visibleText };
      }
    }

    // capturing phase
    const closeIndex = this.buffer.indexOf(CLOSE_TAG);
    if (closeIndex >= 0) {
      this.captured += this.buffer.slice(0, closeIndex);
      const visibleText = this.buffer.slice(closeIndex + CLOSE_TAG.length).replace(/^\s+/, '');
      this.buffer = '';
      this.phase = 'passthrough';
      return { visibleText, cognitiveStream: this.captured };
    }

    // Hold back only enough to resolve a close tag split across chunks.
    const holdback = CLOSE_TAG.length - 1;
    if (this.buffer.length > holdback) {
      this.captured += this.buffer.slice(0, this.buffer.length - holdback);
      this.buffer = this.buffer.slice(this.buffer.length - holdback);
    }
    return { visibleText: '' };
  }

  // Called once the stream ends. Unresolved detection buffer was ordinary
  // text; an unclosed block surfaces as cognitiveStream, never as chat text.
  flushRemaining(): ParsedChunk {
    if (this.phase === 'detecting') {
      const visibleText = this.buffer;
      this.buffer = '';
      return { visibleText };
    }
    if (this.phase === 'capturing') {
      const cognitiveStream = this.captured + this.buffer;
      this.buffer = '';
      this.captured = '';
      return { visibleText: '', cognitiveStream: cognitiveStream || undefined };
    }
    return { visibleText: '' };
  }
}
