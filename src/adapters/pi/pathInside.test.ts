import { describe, expect, it } from 'vitest';

import { assertSandboxPath, resolveSandboxPath } from './pathInside.js';

describe('Pi sandbox paths', () => {
  it('resolves workspace paths and rejects paths outside the allowed directory', () => {
    expect(resolveSandboxPath('draft/document.md', '/tmp/job')).toBe('/tmp/job/draft/document.md');
    expect(
      assertSandboxPath({
        filePath: 'draft/document.md',
        currentDirectory: '/tmp/job',
        allowedDirectory: '/tmp/job/draft',
      }),
    ).toBe('/tmp/job/draft/document.md');
    expect(() =>
      assertSandboxPath({
        filePath: 'extract/source.md',
        currentDirectory: '/tmp/job',
        allowedDirectory: '/tmp/job/draft',
      }),
    ).toThrow('路径不在允许范围内');
  });

  it('supports at-prefixed paths', () => {
    expect(resolveSandboxPath('@brief.md', '/tmp/job')).toBe('/tmp/job/brief.md');
  });
});
