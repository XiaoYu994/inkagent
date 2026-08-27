import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createJobWorkspace, writeBrief } from './workspace.js';

describe('createJobWorkspace', () => {
  it('creates input extract and output directories and a writable brief', async () => {
    const parentDir = await mkdtemp(join(tmpdir(), 'inkagent-job-'));
    const workspace = await createJobWorkspace(parentDir);

    expect(workspace.rootDir).toContain(workspace.jobId);
    await writeBrief(workspace, '写一份说明');
    expect(await readFile(workspace.briefPath, 'utf8')).toContain('写一份说明');
  });
});
