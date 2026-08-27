import { describe, expect, it } from 'vitest';

import { packageName } from './index.js';

describe('packageName', () => {
  it('matches the repository name', () => {
    expect(packageName).toBe('inkagent');
  });
});
