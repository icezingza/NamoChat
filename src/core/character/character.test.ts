import { describe, expect, it } from 'vitest';
import { CharacterValidationError, importCharacterCard } from './character';

const importOptions = { generateId: () => 'id-1', now: () => 1000 };

describe('importCharacterCard', () => {
  it('imports a SillyTavern v2 card', () => {
    const card = importCharacterCard({
      json: {
        spec: 'chara_card_v2',
        data: {
          name: 'Rin',
          description: 'A mysterious muse.',
          personality: 'playful',
          scenario: 'a rainy rooftop bar',
          first_mes: '*she looks up* Oh. You again.',
          tags: ['muse', 42],
        },
      },
      ...importOptions,
    });
    expect(card.name).toBe('Rin');
    expect(card.firstMessage).toContain('You again');
    expect(card.tags).toEqual(['muse']);
    expect(card.id).toBe('id-1');
  });

  it('imports a native NamoChat card and re-mints identity', () => {
    const card = importCharacterCard({
      json: {
        id: 'old',
        name: 'Namo',
        tagline: '',
        description: 'd',
        personality: 'p',
        scenario: 's',
        firstMessage: 'hello',
        tags: ['a'],
        createdAt: 1,
        updatedAt: 1,
      },
      ...importOptions,
    });
    expect(card.id).toBe('id-1');
    expect(card.createdAt).toBe(1000);
  });

  it('rejects cards without a name or first message', () => {
    expect(() =>
      importCharacterCard({ json: { spec: 'chara_card_v2', data: { name: 'X' } }, ...importOptions }),
    ).toThrow(CharacterValidationError);
    expect(() => importCharacterCard({ json: 'nope', ...importOptions })).toThrow(
      CharacterValidationError,
    );
  });
});
