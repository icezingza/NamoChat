import { describe, expect, it } from 'vitest';
import { TokenBudget } from './token-budget';
import { buildTurnContext } from './context-builder';
import { buildSystemPrompt, buildPersonaLock } from './prompt-builder';
import { pickGreeting } from '../character/character';
import { matchLore } from '../lore/lore-engine';
import type { CharacterCard } from '../character/character';

describe('TokenBudget', () => {
  it('keeps only candidates that fit after mandatory texts', () => {
    const budget = new TokenBudget({ maxTokens: 30, reservedOutputTokens: 10 });
    // input budget = 20 tokens = 80 chars
    const kept = budget.selectWithinBudget(['x'.repeat(40)], ['y'.repeat(30), 'z'.repeat(200)]);
    expect(kept).toEqual(['y'.repeat(30)]);
  });
});

describe('buildTurnContext', () => {
  it('always includes the persona block and budget-gates the rest', () => {
    const budget = new TokenBudget({ maxTokens: 100, reservedOutputTokens: 10 });
    const context = buildTurnContext({
      persona: {
        moodLine: 'calm',
        stageName: 'Stranger',
        stageDirective: 'Keep distance.',
        attachmentDirective: 'Be cool.',
        distilledIdentity: 'a muse',
      },
      personaLock: '[Stay in character — non-negotiable]\n- Never break character.',
      memories: [],
      lore: matchLore([{ id: 'l1', keys: ['beach'], content: 'The beach is cursed.' }], 'we went to the beach'),
      storyRecap: '',
      budget,
      historyTexts: [],
      systemPrompt: 'sys',
    });
    expect(context).toContain('[Persona] a muse');
    expect(context).toContain('[Relationship: Stranger]');
    expect(context).toContain('The beach is cursed.');
    expect(context).toContain('non-negotiable');
  });

  it('never trims the persona lock even when over budget', () => {
    const budget = new TokenBudget({ maxTokens: 12, reservedOutputTokens: 10 });
    const context = buildTurnContext({
      persona: {
        moodLine: 'calm',
        stageName: 'Stranger',
        stageDirective: 'Keep distance.',
        attachmentDirective: 'Be cool.',
        distilledIdentity: 'a muse',
      },
      personaLock: '[lock] rule',
      memories: [],
      lore: [{ entry: { id: 'l', keys: [], content: 'x'.repeat(400) }, matchedKey: null }],
      storyRecap: '',
      budget,
      historyTexts: [],
      systemPrompt: 'sys',
    });
    expect(context).toContain('[lock] rule'); // mandatory, survives
    expect(context).not.toContain('x'.repeat(400)); // optional lore trimmed
  });
});

describe('buildSystemPrompt', () => {
  it('renders card fields and never a hardcoded persona', () => {
    const card: CharacterCard = {
      id: 'c1',
      name: 'Rin',
      tagline: '',
      description: 'A muse.',
      personality: 'playful',
      scenario: 'rooftop bar',
      firstMessage: 'hi',
      tags: [],
      language: 'th',
      createdAt: 0,
      updatedAt: 0,
    };
    const prompt = buildSystemPrompt(card, { userName: 'You' });
    expect(prompt).toContain('You are Rin');
    expect(prompt).toContain('## Scenario\nrooftop bar');
    expect(prompt).toContain('"th"');
  });

  it('honors a per-character system-prompt override with placeholder substitution', () => {
    const card: CharacterCard = {
      id: 'c1',
      name: 'Rin',
      tagline: '',
      description: 'A muse.',
      personality: '',
      scenario: '',
      firstMessage: 'hi',
      systemPromptOverride: '{{char}} belongs entirely to {{user}}.',
      tags: [],
      createdAt: 0,
      updatedAt: 0,
    };
    const prompt = buildSystemPrompt(card, { userName: 'Alex' });
    expect(prompt).toContain('Rin belongs entirely to Alex.');
    expect(prompt).not.toContain('You are Rin, a roleplay character');
  });
});

describe('buildPersonaLock', () => {
  it('renders consistency rules and is empty without them', () => {
    const base = { id: 'c', name: 'R', tagline: '', description: '', personality: '', scenario: '', firstMessage: 'h', tags: [], createdAt: 0, updatedAt: 0 };
    expect(buildPersonaLock(base)).toBe('');
    const locked = buildPersonaLock({
      ...base,
      identity: { purpose: [], cognitiveStyle: [], emotionalSignature: [], consistencyRules: ['Stay in character.'] },
    });
    expect(locked).toContain('Stay in character.');
    expect(locked).toContain('non-negotiable');
  });
});

describe('pickGreeting', () => {
  it('chooses among primary + alternate greetings deterministically under a seed', () => {
    const card: CharacterCard = {
      id: 'c', name: 'R', tagline: '', description: '', personality: '', scenario: '',
      firstMessage: 'primary', alternateGreetings: ['alt-a', 'alt-b'], tags: [], createdAt: 0, updatedAt: 0,
    };
    expect(pickGreeting(card, () => 0)).toBe('primary');
    expect(pickGreeting(card, () => 0.5)).toBe('alt-a');
    expect(pickGreeting(card, () => 0.99)).toBe('alt-b');
  });
});
