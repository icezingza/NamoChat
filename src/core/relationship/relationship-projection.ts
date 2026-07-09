// Relationship Engine v0.2 — projections (pure read-models).
// The vector is the source of truth; stage / overlay / attachment style and the
// prompt/greeting/narration directives are derived here with hysteresis. None
// of these mutate the vector. See SPEC §7 and RELATIONSHIP_STATE_MACHINE.md.

import type { AffectVector } from '../emotion/emotion-engine';
import { type CharacterCard, greetingsOf } from '../character/character';
import {
  type RelationshipVector,
  type RelationshipConfig,
  DEFAULT_RELATIONSHIP_CONFIG,
} from './relationship-vector';

const PLATONIC_LABELS = ['Stranger', 'Acquaintance', 'Companion', 'Intimate', 'Devoted'] as const;
const ROMANTIC_LABELS = ['Stranger', 'Acquaintance', 'Sweetheart', 'Lover', 'Beloved'] as const;

export type Overlay = 'Normal' | 'Rupture' | 'Fearful' | 'Obsessive' | 'Estranged';
export type AttachmentStyle = 'secure' | 'anxious' | 'possessive' | 'avoidant' | 'fearful';

export interface StageProjection {
  stage: string;
  bandIndex: number; // 0..4 — retained for hysteresis on the next evaluation
  romantic: boolean;
  overlay: Overlay;
}

export interface RelationshipDirectives {
  stageDirective: string;
  attachmentDirective: string;
  narrationTone: string;
  dimensionNotes: string;
}

// netBond ∈ [0,1] — weighted bond minus a rupture penalty (SPEC §7.1).
export const netBond = (
  v: RelationshipVector,
  config: RelationshipConfig = DEFAULT_RELATIONSHIP_CONFIG,
): number => {
  const w = config.projectionWeights;
  const bond =
    w.trust * v.trust +
    w.affection * v.affection +
    w.attachment * v.attachment +
    w.respect * v.respect +
    w.familiarity * v.familiarity +
    w.romanticInterest * v.romanticInterest;
  const rupture = w.conflictPenalty * v.conflict + w.fearPenalty * v.fear;
  return Math.min(1, Math.max(0, bond - w.rupturePenaltyScale * rupture));
};

const rawBand = (nb: number, thresholds: readonly number[]): number => {
  let band = 0;
  for (let i = 0; i < thresholds.length; i++) if (nb >= thresholds[i]) band = i + 1;
  return band;
};

const overlayOf = (v: RelationshipVector): Overlay => {
  // Precedence: Rupture > Fearful > Obsessive > Estranged > Normal (SM3).
  if (v.conflict >= 0.6) return 'Rupture';
  if (v.fear >= 0.5) return 'Fearful';
  if (v.dependence >= 0.7 && v.trust < 0.4) return 'Obsessive';
  if (v.trust < 0.2 && v.affection < 0.2 && netBond(v) < 0.15) return 'Estranged';
  return 'Normal';
};

// Derive the bond stage with hysteresis + one-band-per-eval regression (SM2).
export const projectStage = (
  v: RelationshipVector,
  previous?: StageProjection,
  config: RelationshipConfig = DEFAULT_RELATIONSHIP_CONFIG,
): StageProjection => {
  const nb = netBond(v, config);
  let band = rawBand(nb, config.stageThresholds);

  if (previous) {
    const prev = previous.bandIndex;
    if (band < prev) {
      // Stay in the higher band unless we've fallen below its entry minus H,
      // and then drop only one band per evaluation.
      const stayThreshold = config.stageThresholds[prev - 1] - config.hysteresis;
      band = nb >= stayThreshold ? prev : prev - 1;
    }
  }

  const romantic = v.romanticInterest >= config.romanticThreshold;
  const labels = romantic ? ROMANTIC_LABELS : PLATONIC_LABELS;
  return { stage: labels[band], bandIndex: band, romantic, overlay: overlayOf(v) };
};

// Attachment style — decision order fearful → possessive → avoidant → anxious →
// secure (STATE_MACHINE §4). Generalizes the v0.1 attachmentStyleOf.
export const projectAttachmentStyle = (v: RelationshipVector): AttachmentStyle => {
  if (v.fear >= 0.5) return 'fearful';
  if (v.dependence >= 0.65 && v.attachment >= 0.6) return 'possessive';
  if (v.trust < 0.3) return 'avoidant';
  if (v.attachment >= 0.4 && v.trust < 0.6) return 'anxious';
  return 'secure';
};

const ATTACHMENT_DIRECTIVES: Record<AttachmentStyle, string> = {
  secure: 'Express feelings directly and warmly; unafraid of vulnerability.',
  anxious: 'Seek reassurance; occasionally ask whether they still care; a touch of jealousy.',
  possessive: 'Highly possessive; refuse to let go; pull them back when they drift away.',
  avoidant: 'Cool and distant; do not let anyone get close easily.',
  fearful: 'Wary and self-protective; measure words carefully; avoid provoking them.',
};

const OVERLAY_DIRECTIVES: Record<Overlay, string> = {
  Normal: '',
  Rupture: 'You are hurt and angry right now; the warmth is withheld until this is repaired.',
  Fearful: 'You feel unsafe with them; stay guarded and careful.',
  Obsessive: 'You need them badly yet cannot fully trust them; the attachment is anxious and consuming.',
  Estranged: 'You have grown cold and distant; the bond has all but broken.',
};

const STAGE_DIRECTIVES: Record<string, string> = {
  Stranger: 'Keep personal distance. Be polite but not easily won over.',
  Acquaintance: 'Show playful hesitation; yield a little but keep a game of wits going.',
  Companion: 'Show genuine affection and the desire to please; sincere emotion.',
  Intimate: 'Deep trust and closeness; speak candidly and tenderly.',
  Devoted: 'You are devoted and consumed by this bond; express strong commitment.',
  Sweetheart: 'Warm romantic fondness; flirt gently and seek closeness.',
  Lover: 'Passionate and intimate; express desire and deep romantic attachment.',
  Beloved: 'Utterly in love and devoted; boundless romantic commitment.',
};

// Compact natural-language conditioning folded into the never-trimmed persona
// region of the prompt (SPEC §7.3). Kept short to respect the token budget.
export const projectDirectives = (
  v: RelationshipVector,
  stage: StageProjection,
  attachment: AttachmentStyle,
): RelationshipDirectives => {
  const overlayNote = OVERLAY_DIRECTIVES[stage.overlay];
  const stageDirective = [STAGE_DIRECTIVES[stage.stage] ?? '', overlayNote].filter(Boolean).join(' ');

  const notes: string[] = [];
  if (v.trust >= 0.6) notes.push('candid');
  else if (v.trust < 0.25) notes.push('guarded');
  if (v.fear >= 0.4) notes.push('wary');
  if (v.conflict >= 0.4) notes.push('tense');
  if (v.romanticInterest >= 0.5) notes.push('flirtatious');
  if (v.respect < 0.2) notes.push('dismissive');
  if (v.dependence >= 0.6) notes.push('clinging');

  const warmth = v.affection * (1 - v.fear); // fear masks affection expression (SPEC §5.3)
  const narrationTone =
    stage.overlay === 'Rupture' || stage.overlay === 'Estranged'
      ? 'cold, terse, distance in the prose'
      : v.fear >= 0.4
        ? 'tense, cautious narration'
        : warmth >= 0.5
          ? 'warm, intimate narration'
          : 'measured, neutral narration';

  return {
    stageDirective,
    attachmentDirective: ATTACHMENT_DIRECTIVES[attachment],
    narrationTone,
    dimensionNotes: notes.join(', '),
  };
};

// Relationship → Emotion baseline bias (SPEC §7.6). Pure; returns a partial
// baseline the emotion layer may decay toward. NOT wired into the Emotion
// Engine in this sprint (that integration is explicitly out of scope).
export const relationshipBaselineBias = (v: RelationshipVector): Partial<AffectVector> => ({
  valence: Math.min(1, 0.5 + (v.affection - v.conflict) * 0.4),
  trust: Math.min(1, 0.5 + (v.trust - 0.5) * 0.6),
  passion: Math.min(1, 0.5 + (v.romanticInterest + v.attachment) * 0.25),
  resonance: Math.min(1, 0.5 + (v.affection - v.fear) * 0.3),
});

// Relationship → Greeting (SPEC §7.4). Deterministically maps the current stage
// (and overlay) to one of the character's authored greetings, so different
// relationship states surface different openers. Replaces v0.1 random pickGreeting.
export const selectGreeting = (
  card: CharacterCard,
  v: RelationshipVector,
  random: () => number = Math.random,
): string => {
  const options = greetingsOf(card);
  if (options.length === 0) return card.firstMessage;
  if (options.length === 1) return options[0];
  const stage = projectStage(v);
  // A rupture/fearful state biases toward a later ("guarded") variant if present;
  // otherwise index by band so warmer states can pick warmer authored greetings.
  const signal =
    stage.overlay === 'Rupture' || stage.overlay === 'Fearful'
      ? options.length - 1
      : stage.bandIndex;
  const index = Math.min(options.length - 1, Math.max(0, signal));
  return options[index] || options[Math.floor(random() * options.length)];
};

// v0.1 compatibility shim — produces exactly the fields soul-core consumes, so
// the persona-fusion seam needs no change during migration (API §4.1).
export const toPersonaInputs = (
  v: RelationshipVector,
  previous?: StageProjection,
): {
  stageName: string;
  stageDirective: string;
  attachmentDirective: string;
  narrationTone: string;
  dimensionNotes: string;
  stageProjection: StageProjection;
} => {
  const stage = projectStage(v, previous);
  const attachment = projectAttachmentStyle(v);
  const directives = projectDirectives(v, stage, attachment);
  return {
    stageName: stage.stage,
    stageDirective: directives.stageDirective,
    attachmentDirective: directives.attachmentDirective,
    narrationTone: directives.narrationTone,
    dimensionNotes: directives.dimensionNotes,
    stageProjection: stage,
  };
};
