// Ported from darknamo-nexus-3 core/identity/IdentityCapsule.ts, extended with
// the namo-identity-capsule schema fields (emotional signature, consistency
// rules). Pure data + string formatting: no LLM/DOM/network/storage access.

export interface IdentityBlueprint {
  purpose: string[]; // what the character exists to be/do in the story
  cognitiveStyle: string[]; // how they think and speak
  emotionalSignature: string[]; // baseline emotional texture
  consistencyRules: string[]; // hard rules the persona never breaks
}

export class IdentityCapsule {
  constructor(private readonly blueprint: IdentityBlueprint) {}

  // Full bullet-list rendering — loaded once per chat as part of the system
  // prompt, not resent per turn (token-budget rule).
  getSystemContext(): string {
    const section = (label: string, lines: string[]) =>
      lines.length === 0 ? '' : `${label}:\n${lines.map((line) => `- ${line}`).join('\n')}`;

    return [
      section('Purpose', this.blueprint.purpose),
      section('Cognitive style', this.blueprint.cognitiveStyle),
      section('Emotional signature', this.blueprint.emotionalSignature),
      section('Consistency rules', this.blueprint.consistencyRules),
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  // Single-line compression folded into the per-turn context block so the
  // model gets a lightweight persona reminder without the full block.
  getDistilledContext(currentMood = ''): string {
    const compact = (lines: string[]) => lines.join('; ');
    const identityLine = [
      compact(this.blueprint.purpose),
      compact(this.blueprint.consistencyRules),
    ]
      .filter(Boolean)
      .join(' | ');
    return currentMood ? `${identityLine}\n${currentMood}` : identityLine;
  }
}
