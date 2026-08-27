import { mkdtemp, mkdir, writeFile, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { InkAgentError } from '../errors.js';
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

  it('follows a symlink and copies the target content', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), 'inkagent-src-'));
    const destinationDir = join(sourceDir, 'dest');
    const targetDir = await mkdtemp(join(tmpdir(), 'inkagent-target-'));
    await writeFile(join(targetDir, 'notes.md'), '# 真材料\n');
    await symlink(join(targetDir, 'notes.md'), join(sourceDir, 'link.md'));

    const copied = await copyInputTree(sourceDir, destinationDir);

    expect(copied).toEqual(['link.md']);
    expect(await readFile(join(destinationDir, 'link.md'), 'utf8')).toContain('真材料');
  });

  it('rejects a symlink pointing outside or nowhere instead of skipping silently', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), 'inkagent-src-'));
    const destinationDir = join(sourceDir, 'dest');
    await symlink(join(sourceDir, 'missing.md'), join(sourceDir, 'broken.md'));

    await expect(copyInputTree(sourceDir, destinationDir)).rejects.toBeInstanceOf(InkAgentError);
  });
});
