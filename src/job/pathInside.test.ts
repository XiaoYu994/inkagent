import { homedir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { assertPathInside, isPathInside, resolveToolPath } from './pathInside.js';

describe('isPathInside', () => {
  it('accepts the root and nested paths, rejects siblings and parent escapes', () => {
    const root = '/tmp/job';

    expect(isPathInside('/tmp/job', root)).toBe(true);
    expect(isPathInside('/tmp/job/output/doc.md', root)).toBe(true);
    expect(isPathInside('/tmp/job/../job/a', root)).toBe(true);
    expect(isPathInside('/tmp/other', root)).toBe(false);
    expect(isPathInside('/tmp/job-extra', root)).toBe(false);
    expect(isPathInside('/tmp/job/../secret', root)).toBe(false);
  });
});

describe('resolveToolPath', () => {
  it('resolves relative, absolute, tilde, and at-prefixed paths', () => {
    const cwd = '/tmp/job';

    expect(resolveToolPath('output/doc.md', cwd)).toBe(join(cwd, 'output/doc.md'));
    expect(resolveToolPath('/etc/passwd', cwd)).toBe('/etc/passwd');
    expect(resolveToolPath('~/notes.md', cwd)).toBe(join(homedir(), 'notes.md'));
    expect(resolveToolPath('@brief.md', cwd)).toBe(join(cwd, 'brief.md'));
  });
});

describe('assertPathInside', () => {
  it('returns the absolute path when inside the root and throws otherwise', () => {
    const cwd = '/tmp/job';
    const root = '/tmp/job/output';

    expect(assertPathInside('output/doc.md', cwd, root)).toBe(join(cwd, 'output/doc.md'));
    expect(() => assertPathInside('/etc/passwd', cwd, root)).toThrow(/允许范围/);
    expect(() => assertPathInside('extract/a.md', cwd, root)).toThrow(/允许范围/);
  });
});
