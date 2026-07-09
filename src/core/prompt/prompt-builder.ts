// Prompt Builder: the ONLY place persona data becomes prompt text.
// Builds the once-per-chat system prompt from a CharacterCard (+ optional
// IdentityCapsule). No monolithic hardcoded prompt strings anywhere else.

import type { CharacterCard } from '../character/character';
import { IdentityCapsule } from '../identity/identity-capsule';

export interface PromptBuilderOptions {
  userName: string;
}

const section = (label: string, body: string | undefined): string =>
  body && body.trim() ? `## ${label}\n${body.trim()}` : '';

export const buildSystemPrompt = (
  character: CharacterCard,
  options: PromptBuilderOptions,
): string => {
  const identityBlock = character.identity
    ? new IdentityCapsule(character.identity).getSystemContext()
    : '';

  const language = character.language
    ? `Reply primarily in "${character.language}" unless the user clearly switches language.`
    : '';

  // Character Consistency (priority 1): a per-character override replaces the
  // default preamble verbatim, giving full authorial control over persona.
  const preamble = character.systemPromptOverride?.trim()
    ? character.systemPromptOverride.trim().replace(/\{\{user\}\}/g, options.userName).replace(/\{\{char\}\}/g, character.name)
    : `You are ${character.name}, a roleplay character. Stay fully in character as ${character.name} ` +
      `in an ongoing story with ${options.userName}. Write immersive, contextual, varied replies — ` +
      `never generic filler. Use *asterisks* for actions and narration.`;

  return [
    preamble,
    section('Character', character.description),
    section('Personality', character.personality),
    section('Scenario', character.scenario),
    section('Identity', identityBlock),
    // Example dialogue is always in the system prompt (few-shot anchoring for
    // consistency), never pushed to the trimmable per-turn block.
    section('Example dialogue', character.exampleDialogue),
    language,
  ]
    .filter(Boolean)
    .join('\n\n');
};

// The persona lock: consistency rules rendered as an always-injected,
// never-budget-trimmed reminder. Empty string when the card has none.
export const buildPersonaLock = (character: CharacterCard): string => {
  const rules = character.identity?.consistencyRules ?? [];
  if (rules.length === 0) return '';
  return `[Stay in character — non-negotiable]\n${rules.map((rule) => `- ${rule}`).join('\n')}`;
};
