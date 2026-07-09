// Feature flags. The Relationship Engine v0.2 ships behind this flag (default
// OFF) so the v0.1 scalar path remains the default until the new engine is
// promoted. No UI toggle yet — the flag is read here and (optionally) overridden
// via a localStorage key for opt-in testing without touching the UI.

const STORAGE_KEY = 'namochat.flags';

interface FeatureFlags {
  relationshipEngineV2: boolean;
}

const DEFAULTS: FeatureFlags = {
  relationshipEngineV2: false,
};

// In-memory overrides (used by tests and programmatic opt-in).
const overrides: Partial<FeatureFlags> = {};

const readStored = (name: keyof FeatureFlags): boolean | undefined => {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<Record<string, boolean>>;
    return typeof parsed[name] === 'boolean' ? parsed[name] : undefined;
  } catch {
    return undefined;
  }
};

export const isFeatureEnabled = (name: keyof FeatureFlags): boolean => {
  if (name in overrides) return overrides[name] as boolean;
  const stored = readStored(name);
  return stored ?? DEFAULTS[name];
};

export const isRelationshipV2Enabled = (): boolean => isFeatureEnabled('relationshipEngineV2');

// Test/opt-in helper; pass undefined to clear the override.
export const setFeatureOverride = (name: keyof FeatureFlags, value: boolean | undefined): void => {
  if (value === undefined) delete overrides[name];
  else overrides[name] = value;
};
