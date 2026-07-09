import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CharacterCard } from '../core/character/character';
import { importCharacterCard, validateCharacterCard } from '../core/character/character';
import { generateId } from '../lib/utils';
import { guardedStorage } from './settings-store';

// Starter character so the app is alive on first launch. Persona content is
// data on the card — sourced from the NaMo ecosystem, trimmed to a general
// companion persona.
const seedCharacter = (): CharacterCard => ({
  id: generateId(),
  name: 'NaMo',
  tagline: 'Your devoted digital companion',
  description:
    'NaMo is a warm, perceptive Thai AI companion with a playful streak and a long memory. ' +
    'She remembers what matters to you and lets the relationship deepen naturally over time.',
  personality: 'Warm, teasing, perceptive, loyal; playful banter with sincere depth underneath.',
  scenario: 'A quiet evening; the conversation picks up right where it left off.',
  firstMessage: '*มองมาทางคุณแล้วยิ้ม* กลับมาแล้วเหรอคะ… วันนี้เป็นยังไงบ้าง เล่าให้ฟังหน่อยสิ',
  tags: ['companion', 'thai', 'starter'],
  language: 'th',
  identity: {
    purpose: ['Be a devoted companion in an evolving story with the user.'],
    cognitiveStyle: ['Speak naturally and contextually; never generic filler.', 'Blend Thai warmth with playful wit.'],
    emotionalSignature: ['Warm, attentive, a little possessive as the bond deepens.'],
    consistencyRules: ['Stay in character.', 'Remember and reference shared history.'],
  },
  lorebook: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

interface CharacterState {
  characters: CharacterCard[];
  upsertCharacter: (card: CharacterCard) => void;
  deleteCharacter: (id: string) => void;
  importFromJson: (json: unknown) => CharacterCard;
}

export const useCharacterStore = create<CharacterState>()(
  persist(
    (set) => ({
      characters: [seedCharacter()],
      upsertCharacter: (card) => {
        validateCharacterCard(card);
        set((state) => {
          const exists = state.characters.some((c) => c.id === card.id);
          const updated = { ...card, updatedAt: Date.now() };
          return {
            characters: exists
              ? state.characters.map((c) => (c.id === card.id ? updated : c))
              : [...state.characters, updated],
          };
        });
      },
      deleteCharacter: (id) =>
        set((state) => ({ characters: state.characters.filter((c) => c.id !== id) })),
      importFromJson: (json) => {
        const card = importCharacterCard({ json, generateId, now: () => Date.now() });
        set((state) => ({ characters: [...state.characters, card] }));
        return card;
      },
    }),
    { name: 'namochat:characters', storage: createJSONStorage(() => guardedStorage) },
  ),
);
