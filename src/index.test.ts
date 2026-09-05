import { describe, expect, it } from 'vitest';

import { defaultInputResourceLimits } from './index.js';

describe('public API', () => {
  it('exports the default input resource limits', () => {
    expect(defaultInputResourceLimits).toEqual({
      maxFiles: 1000,
      maxFileBytes: 50 * 1024 * 1024,
      maxTotalBytes: 200 * 1024 * 1024,
    });
  });

  it('keeps the default input resource limits immutable', () => {
    expect(Object.isFrozen(defaultInputResourceLimits)).toBe(true);
  });
});
