import { describe, it, expect, afterEach } from 'vitest';
import { isRelationshipV2Enabled, setFeatureOverride } from './feature-flags';

afterEach(() => setFeatureOverride('relationshipEngineV2', undefined));

describe('feature flags', () => {
  it('relationshipEngineV2 defaults OFF (backward compatible)', () => {
    expect(isRelationshipV2Enabled()).toBe(false);
  });

  it('can be overridden on for opt-in testing', () => {
    setFeatureOverride('relationshipEngineV2', true);
    expect(isRelationshipV2Enabled()).toBe(true);
  });
});
