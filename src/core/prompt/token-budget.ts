// Ported from darknamo-nexus-3 core/Token_Budget.ts: heuristic length/4
// estimate with reserved output headroom. Every piece of context injected
// into a request must pass through this gate before being appended.

export interface TokenBudgetConfig {
  maxTokens: number; // total context window budget for the request
  reservedOutputTokens: number; // headroom left for the model's reply
}

export class TokenBudget {
  constructor(private readonly config: TokenBudgetConfig) {}

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  estimateTexts(texts: string[]): number {
    return texts.reduce((sum, text) => sum + this.estimateTokens(text), 0);
  }

  get inputBudget(): number {
    return Math.max(0, this.config.maxTokens - this.config.reservedOutputTokens);
  }

  fits(texts: string[]): boolean {
    return this.estimateTexts(texts) <= this.inputBudget;
  }

  // Greedily keep candidates (in priority order) that still fit alongside the
  // mandatory texts; the mandatory set is never trimmed here — callers decide
  // what is mandatory.
  selectWithinBudget(mandatory: string[], candidates: string[]): string[] {
    let used = this.estimateTexts(mandatory);
    const kept: string[] = [];
    for (const candidate of candidates) {
      const cost = this.estimateTokens(candidate);
      if (used + cost > this.inputBudget) continue;
      used += cost;
      kept.push(candidate);
    }
    return kept;
  }
}
