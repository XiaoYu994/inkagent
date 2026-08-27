import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { copyInputTree, createJobWorkspace, writeBrief } from './workspace.js';

describe('createJobWorkspace', () => {
  it('creates input extract and output directories', async () => {
    const parentDir = await mkdtemp(join(tmpdir(), 'inkagent-job-'));
    const workspace = await createJobWorkspace(parentDir);

    expect(workspace.rootDir).toContain(workspace.jobId);
    await writeBrief(workspace, '写一份说明');
    expect(await readFile(workspace.briefPath, 'utf8')).toContain('写一份说明');
  });
});

describe('copyInputTree', () => {
  it('copies nested files and skips hidden paths', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), 'inkagent-src-'));
    const destinationDir = join(sourceDir, 'dest');
    await mkdir(join(sourceDir, 'nested'), { recursive: true });
    await writeFile(join(sourceDir, 'nested', 'a.md'), 'a');
    await writeFile(join(sourceDir, '.secret'), 'no');

    const copied = await copyInputTree(sourceDir, destinationDir);

    expect(copied).toEqual(['nested/a.md']);
    expect(await readFile(join(destinationDir, 'nested', 'a.md'), 'utf8')).toBe('a');
  });
});
