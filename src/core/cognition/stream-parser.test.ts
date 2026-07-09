import { describe, expect, it } from 'vitest';
import { CognitiveStreamParser } from './stream-parser';

const collect = (chunks: string[]) => {
  const parser = new CognitiveStreamParser();
  let visible = '';
  let stream: string | undefined;
  for (const chunk of chunks) {
    const parsed = parser.processChunk(chunk);
    visible += parsed.visibleText;
    if (parsed.cognitiveStream) stream = parsed.cognitiveStream;
  }
  const final = parser.flushRemaining();
  visible += final.visibleText;
  if (final.cognitiveStream) stream = final.cognitiveStream;
  return { visible, stream };
};

describe('CognitiveStreamParser', () => {
  it('passes ordinary text through untouched', () => {
    expect(collect(['Hello ', 'world']).visible).toBe('Hello world');
  });

  it('strips a leading cognitive_stream block, even split across chunks', () => {
    const { visible, stream } = collect([
      '<cognitive_str',
      'eam>secret thoughts</cognitive_',
      'stream>Hi there',
    ]);
    expect(visible).toBe('Hi there');
    expect(stream).toBe('secret thoughts');
  });

  it('a truncated (never-closed) block never leaks as chat text', () => {
    const { visible, stream } = collect(['<cognitive_stream>half a thought']);
    expect(visible).toBe('');
    expect(stream).toBe('half a thought');
  });

  it('text resembling a tag prefix surfaces as visible on flush', () => {
    const { visible } = collect(['<cogni']);
    expect(visible).toBe('<cogni');
  });
});
