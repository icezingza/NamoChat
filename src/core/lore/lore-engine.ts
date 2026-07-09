// Lore Engine: keyword-triggered world-knowledge entries (lorebook), the
// client-side successor to the Forbidden Archive's server RAG. An entry is
// injected only when one of its keys appears in the recent conversation text.

export interface LoreEntry {
  id: string;
  keys: string[]; // trigger keywords (case-insensitive)
  content: string; // text injected into the context when triggered
  alwaysActive?: boolean; // world facts injected on every turn
}

export interface LoreMatch {
  entry: LoreEntry;
  matchedKey: string | null; // null when alwaysActive
}

export const matchLore = (entries: LoreEntry[], scanText: string, limit = 5): LoreMatch[] => {
  const haystack = scanText.toLowerCase();
  const matches: LoreMatch[] = [];

  for (const entry of entries) {
    if (entry.alwaysActive) {
      matches.push({ entry, matchedKey: null });
      continue;
    }
    const matchedKey = entry.keys.find(
      (key) => key.trim() !== '' && haystack.includes(key.toLowerCase()),
    );
    if (matchedKey) matches.push({ entry, matchedKey });
  }

  return matches.slice(0, limit);
};
