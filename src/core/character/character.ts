// Character Engine: the CharacterCard schema, validation, and import.
// Persona is data, not code (identity-capsule principle): a card carries
// everything the Prompt Builder needs, including an optional structured
// identity blueprint and relationship-stage configuration.

import type { IdentityBlueprint } from '../identity/identity-capsule';
import type { RelationshipStageConfig } from '../relationship/relationship-engine';
import type { LoreEntry } from '../lore/lore-engine';

export interface CharacterCard {
  id: string;
  name: string;
  tagline: string; // one-line hook shown on the card
  description: string; // who the character is (prompt-visible)
  personality: string; // temperament summary (prompt-visible)
  scenario: string; // current setting/premise (prompt-visible)
  firstMessage: string; // greeting that opens a new chat
  alternateGreetings?: string[]; // additional first-message variants (v2 cards)
  systemPromptOverride?: string; // replaces the default preamble when set
  exampleDialogue?: string; // few-shot style examples
  avatarUrl?: string; // data: URI or remote URL
  tags: string[];
  language?: string; // preferred reply language, e.g. 'th', 'en'
  identity?: IdentityBlueprint; // structured persona (optional, preferred)
  stages?: RelationshipStageConfig[]; // custom relationship progression
  lorebook?: LoreEntry[]; // world knowledge bound to this character
  createdAt: number;
  updatedAt: number;
}

export class CharacterValidationError extends Error {}

export const validateCharacterCard = (card: CharacterCard): void => {
  if (!card.id) throw new CharacterValidationError('Character card is missing an id.');
  if (!card.name.trim()) throw new CharacterValidationError('Character name is required.');
  if (!card.firstMessage.trim()) {
    throw new CharacterValidationError('Character first message is required.');
  }
};

interface ImportInput {
  json: unknown;
  generateId: () => string;
  now: () => number;
}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '') : [];

// All non-empty greetings for a card, primary first.
export const greetingsOf = (card: CharacterCard): string[] =>
  [card.firstMessage, ...(card.alternateGreetings ?? [])].filter((g) => g.trim() !== '');

// Deterministic-free pick of a greeting variant when opening a new chat.
export const pickGreeting = (card: CharacterCard, random: () => number = Math.random): string => {
  const options = greetingsOf(card);
  if (options.length === 0) return card.firstMessage;
  return options[Math.floor(random() * options.length)];
};

// Accepts NamoChat native cards and SillyTavern/TavernAI v2 card JSON
// ({ spec: 'chara_card_v2', data: {...} } or a flat v1 object).
export const importCharacterCard = ({ json, generateId, now }: ImportInput): CharacterCard => {
  if (typeof json !== 'object' || json === null) {
    throw new CharacterValidationError('Import payload is not a JSON object.');
  }
  const root = json as Record<string, unknown>;

  // Native NamoChat card: already in shape, just re-mint id/timestamps.
  if (typeof root.firstMessage === 'string' && typeof root.name === 'string') {
    const card: CharacterCard = {
      ...(root as unknown as CharacterCard),
      id: generateId(),
      tags: Array.isArray(root.tags) ? (root.tags as string[]) : [],
      createdAt: now(),
      updatedAt: now(),
    };
    validateCharacterCard(card);
    return card;
  }

  const data =
    root.spec === 'chara_card_v2' && typeof root.data === 'object' && root.data !== null
      ? (root.data as Record<string, unknown>)
      : root;

  const card: CharacterCard = {
    id: generateId(),
    name: asString(data.name),
    tagline: asString(data.creator_notes).split('\n')[0] ?? '',
    description: asString(data.description),
    personality: asString(data.personality),
    scenario: asString(data.scenario),
    firstMessage: asString(data.first_mes),
    alternateGreetings: asStringArray(data.alternate_greetings),
    systemPromptOverride: asString(data.system_prompt) || undefined,
    exampleDialogue: asString(data.mes_example) || undefined,
    avatarUrl: asString(data.avatar) || undefined,
    tags: Array.isArray(data.tags) ? data.tags.filter((t): t is string => typeof t === 'string') : [],
    createdAt: now(),
    updatedAt: now(),
  };
  validateCharacterCard(card);
  return card;
};

export const exportCharacterCard = (card: CharacterCard): string =>
  JSON.stringify(card, null, 2);
