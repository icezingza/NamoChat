import { describe, it, expect } from 'vitest';
import type { RelationshipVector } from './relationship-vector';
import {
  netBond,
  projectStage,
  projectAttachmentStyle,
  projectDirectives,
  selectGreeting,
  toPersonaInputs,
} from './relationship-projection';
import type { CharacterCard } from '../character/character';

const vec = (over: Partial<RelationshipVector> = {}): RelationshipVector => ({
  trust: 0, affection: 0, respect: 0, attachment: 0, dependence: 0,
  familiarity: 0, romanticInterest: 0, conflict: 0, fear: 0, ...over,
});

describe('netBond', () => {
  it('matches the weighted formula', () => {
    expect(netBond(vec({ trust: 1 }))).toBeCloseTo(0.3, 5);
    expect(netBond(vec({ trust: 1, conflict: 1 }))).toBeCloseTo(0.3 - 0.5 * 0.6, 5);
  });
});

describe('projectStage', () => {
  it('maps bands correctly', () => {
    expect(projectStage(vec()).stage).toBe('Stranger');
    expect(projectStage(vec({ trust: 1 })).stage).toBe('Acquaintance'); // 0.30
    expect(projectStage(vec({ trust: 1, affection: 1, attachment: 1 })).stage).toBe('Companion'); // 0.65
    expect(projectStage(vec({ trust: 1, affection: 1, attachment: 1, respect: 1, familiarity: 1 })).stage).toBe('Devoted');
  });

  it('applies hysteresis and one-band-per-eval regression (SM2)', () => {
    const prev = projectStage(vec({ trust: 1, affection: 1, attachment: 1 })); // Companion, band 2
    // netBond 0.44 — below 0.45 but within hysteresis of the Companion floor → stays.
    const stay = projectStage(vec({ trust: 1, affection: 0.7 }), prev);
    expect(stay.stage).toBe('Companion');
    // netBond 0.40 — below floor − H → drops exactly one band.
    const drop = projectStage(vec({ trust: 1, affection: 0.5 }), prev);
    expect(drop.stage).toBe('Acquaintance');
  });

  it('relabels to the romantic track when romanticInterest ≥ threshold', () => {
    // trust+affection+attachment (0.65) + romanticInterest weight (0.06) = 0.71 → Intimate band.
    const p = projectStage(vec({ trust: 1, affection: 1, attachment: 1, romanticInterest: 0.6 }));
    expect(p.romantic).toBe(true);
    expect(p.stage).toBe('Lover'); // Intimate band, romantic label
    // A pure Companion-band vector with romance shows the Sweetheart label.
    expect(projectStage(vec({ trust: 1, affection: 0.75, romanticInterest: 0.6 })).stage).toBe('Sweetheart');
  });

  it('overlay precedence: Rupture > Fearful > Obsessive', () => {
    expect(projectStage(vec({ conflict: 0.7, fear: 0.7 })).overlay).toBe('Rupture');
    expect(projectStage(vec({ fear: 0.6 })).overlay).toBe('Fearful');
    expect(projectStage(vec({ dependence: 0.8, trust: 0.3 })).overlay).toBe('Obsessive');
    expect(projectStage(vec({ trust: 0.5 })).overlay).toBe('Normal');
  });
});

describe('projectAttachmentStyle', () => {
  it('follows the decision order fearful → possessive → avoidant → anxious → secure', () => {
    expect(projectAttachmentStyle(vec({ fear: 0.6 }))).toBe('fearful');
    expect(projectAttachmentStyle(vec({ dependence: 0.7, attachment: 0.7 }))).toBe('possessive');
    expect(projectAttachmentStyle(vec({ trust: 0.2 }))).toBe('avoidant');
    expect(projectAttachmentStyle(vec({ attachment: 0.5, trust: 0.5 }))).toBe('anxious');
    expect(projectAttachmentStyle(vec({ trust: 0.8, attachment: 0.3 }))).toBe('secure');
  });
});

describe('projectDirectives', () => {
  it('emits an overlay note and dimension notes, is compact', () => {
    const v = vec({ trust: 0.7, conflict: 0.7 });
    const stage = projectStage(v);
    const d = projectDirectives(v, stage, projectAttachmentStyle(v));
    expect(d.stageDirective).toContain('repaired'); // rupture overlay note
    expect(d.dimensionNotes).toContain('tense');
    expect(d.narrationTone).toContain('cold');
  });
});

describe('selectGreeting', () => {
  const card: CharacterCard = {
    id: 'c', name: 'R', tagline: '', description: '', personality: '', scenario: '',
    firstMessage: 'g0', alternateGreetings: ['g1', 'g2'], tags: [], createdAt: 0, updatedAt: 0,
  };

  it('picks by stage band and is deterministic', () => {
    expect(selectGreeting(card, vec())).toBe('g0'); // Stranger, band 0
    expect(selectGreeting(card, vec({ trust: 1, affection: 1, attachment: 1 }))).toBe('g2'); // Companion → clamped to last
  });

  it('falls back to the sole greeting when no alternates', () => {
    expect(selectGreeting({ ...card, alternateGreetings: [] }, vec({ trust: 1 }))).toBe('g0');
  });
});

describe('toPersonaInputs (compatibility shim)', () => {
  it('produces the exact fields soul-core consumes', () => {
    const out = toPersonaInputs(vec({ trust: 0.6, affection: 0.5 }));
    expect(out).toHaveProperty('stageName');
    expect(out).toHaveProperty('stageDirective');
    expect(out).toHaveProperty('attachmentDirective');
    expect(typeof out.stageName).toBe('string');
  });
});
