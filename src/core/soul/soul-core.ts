// Soul Core — realizes the namofusion-soul-core intent as working code: the
// single fusion point that turns identity + affect + relationship into one
// PersonaState consumed by the Context Builder. Pure function of its inputs.

import { describeAffect, type AffectVector } from '../emotion/emotion-engine';
import type { IdentityCapsule } from '../identity/identity-capsule';
import {
  RelationshipEngine,
  type RelationshipState,
} from '../relationship/relationship-engine';

export interface PersonaState {
  moodLine: string; // human-readable affect summary
  stageName: string;
  stageDirective: string; // stage prompt modifier
  attachmentDirective: string;
  distilledIdentity: string; // one-line persona reminder for this turn
}

export const derivePersonaState = (
  identity: IdentityCapsule,
  affect: AffectVector,
  relationship: RelationshipState,
  relationshipEngine: RelationshipEngine,
): PersonaState => {
  const stage = relationshipEngine.stageOf(relationship);
  const attachment = relationshipEngine.attachmentStyleOf(relationship, affect.trust);
  const moodLine = `Current ${describeAffect(affect)}.`;

  return {
    moodLine,
    stageName: stage.name,
    stageDirective: stage.promptModifier,
    attachmentDirective: attachment.promptDirective,
    distilledIdentity: identity.getDistilledContext(moodLine),
  };
};
