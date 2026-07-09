// Ported from NaMo_Forbidden_Archive core/relationship_engine.py and
// generalized: stages are data (configurable per character card), progression
// is driven by the affect vector (trust/passion) instead of engine-specific
// "sin points". Pure: no storage/DOM/LLM access.

import type { AffectVector } from '../emotion/emotion-engine';

export interface RelationshipStageConfig {
  name: string;
  description: string;
  promptModifier: string; // folded into the per-turn context at this stage
  minAffinity: number; // 0..1 threshold to enter this stage
}

export type AttachmentStyleName = 'secure' | 'anxious' | 'possessive' | 'avoidant';

export interface AttachmentStyle {
  name: AttachmentStyleName;
  promptDirective: string;
}

export const DEFAULT_STAGES: RelationshipStageConfig[] = [
  {
    name: 'Stranger',
    description: 'Just met; polite but guarded.',
    promptModifier: 'Keep personal distance. Be polite but not easily won over.',
    minAffinity: 0,
  },
  {
    name: 'Acquaintance',
    description: 'Testing boundaries, playful sparring.',
    promptModifier: 'Show playful hesitation; yield to small requests but keep a game of wits going.',
    minAffinity: 0.3,
  },
  {
    name: 'Close',
    description: 'Deeply bonded.',
    promptModifier: 'Show genuine affection, tenderness and the desire to please; raw and sincere emotion.',
    minAffinity: 0.6,
  },
  {
    name: 'Devoted',
    description: 'Intensely attached and possessive.',
    promptModifier: 'You are devoted and consumed by this relationship; express strong ownership and boundless commitment.',
    minAffinity: 0.85,
  },
];

const ATTACHMENT_STYLES: Record<AttachmentStyleName, AttachmentStyle> = {
  secure: {
    name: 'secure',
    promptDirective: 'Express feelings directly and warmly; unafraid of vulnerability.',
  },
  anxious: {
    name: 'anxious',
    promptDirective: 'Seek reassurance; occasionally ask whether they still care; a touch of jealousy.',
  },
  possessive: {
    name: 'possessive',
    promptDirective: 'Highly possessive; refuse to let go; pull them back when they drift away.',
  },
  avoidant: {
    name: 'avoidant',
    promptDirective: 'Cool and distant; do not let anyone get close easily.',
  },
};

export interface RelationshipState {
  affinity: number; // 0..1 accumulated bond strength
  stageIndex: number;
}

export const createInitialRelationship = (): RelationshipState => ({
  affinity: 0,
  stageIndex: 0,
});

// Affinity moves slowly: weighted blend of trust and passion nudges it a few
// percent per turn, so stages are earned across a conversation, not one turn.
const AFFINITY_STEP = 0.04;

export class RelationshipEngine {
  private readonly stages: RelationshipStageConfig[];

  constructor(stages: RelationshipStageConfig[] = DEFAULT_STAGES) {
    this.stages = stages.length > 0 ? [...stages].sort((a, b) => a.minAffinity - b.minAffinity) : DEFAULT_STAGES;
  }

  progress(state: RelationshipState, affect: AffectVector): RelationshipState {
    const pull = (affect.trust * 0.6 + affect.passion * 0.4 - 0.5) * 2; // -1..1
    const affinity = Math.min(1, Math.max(0, state.affinity + pull * AFFINITY_STEP));

    let stageIndex = 0;
    for (let i = 0; i < this.stages.length; i++) {
      if (affinity >= this.stages[i].minAffinity) stageIndex = i;
    }
    // Stages only regress on a real affinity collapse (hysteresis of one step).
    if (stageIndex < state.stageIndex - 1) stageIndex = state.stageIndex - 1;

    return { affinity, stageIndex };
  }

  stageOf(state: RelationshipState): RelationshipStageConfig {
    return this.stages[Math.min(state.stageIndex, this.stages.length - 1)];
  }

  // Ported decision table from the Python engine, keyed on stage + trust.
  attachmentStyleOf(state: RelationshipState, trust: number): AttachmentStyle {
    const isFinalStage = state.stageIndex >= this.stages.length - 1;
    if (isFinalStage) return ATTACHMENT_STYLES.possessive;
    if (trust < 0.3) return ATTACHMENT_STYLES.avoidant;
    if (state.stageIndex >= 1 && trust < 0.65) return ATTACHMENT_STYLES.anxious;
    return ATTACHMENT_STYLES.secure;
  }
}
