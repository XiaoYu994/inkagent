import { mkdtemp, mkdir, writeFile, readFile, symlink, stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { InkAgentError } from '../errors.js';
import { copyInputTree, copyOutputTree } from './copyTree.js';

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

  it('follows a file symlink and copies the target content', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), 'inkagent-src-'));
    const destinationDir = join(sourceDir, 'dest');
    const targetDir = await mkdtemp(join(tmpdir(), 'inkagent-target-'));
    await writeFile(join(targetDir, 'notes.md'), '# 真材料\n');
    await symlink(join(targetDir, 'notes.md'), join(sourceDir, 'link.md'));

    const copied = await copyInputTree(sourceDir, destinationDir);

    expect(copied).toEqual(['link.md']);
    expect(await readFile(join(destinationDir, 'link.md'), 'utf8')).toContain('真材料');
  });

  it('rejects a dangling symlink instead of skipping silently', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), 'inkagent-src-'));
    const destinationDir = join(sourceDir, 'dest');
    await symlink(join(sourceDir, 'missing.md'), join(sourceDir, 'broken.md'));

    await expect(copyInputTree(sourceDir, destinationDir)).rejects.toBeInstanceOf(InkAgentError);
  });

  it('rejects a directory symlink', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), 'inkagent-src-'));
    const destinationDir = join(sourceDir, 'dest');
    const outsideDir = await mkdtemp(join(tmpdir(), 'inkagent-outside-'));
    await writeFile(join(outsideDir, 'secret.md'), 'no');
    await symlink(outsideDir, join(sourceDir, 'docs'));

    await expect(copyInputTree(sourceDir, destinationDir)).rejects.toThrow(/非文件路径/);
  });
});

describe('copyOutputTree', () => {
  it('rejects an empty output tree as missing generated markdown without wiping dest', async () => {
    const root = await mkdtemp(join(tmpdir(), 'inkagent-out-'));
    const sourceDir = join(root, 'src');
    const destinationDir = join(root, 'dest');
    await mkdir(sourceDir);
    await mkdir(destinationDir);
    await writeFile(join(sourceDir, 'notes.txt'), 'not md');
    await writeFile(join(destinationDir, 'keep.md'), 'keep');

    await expect(copyOutputTree(sourceDir, destinationDir)).rejects.toBeInstanceOf(InkAgentError);
    expect(await readFile(join(destinationDir, 'keep.md'), 'utf8')).toBe('keep');
  });

  it('copies only markdown and removes leftover files from a previous run', async () => {
    const root = await mkdtemp(join(tmpdir(), 'inkagent-out-clean-'));
    const sourceDir = join(root, 'src');
    const destinationDir = join(root, 'dest');
    await mkdir(sourceDir);
    await writeFile(join(sourceDir, 'document.md'), '# v1\n');
    await writeFile(join(sourceDir, 'chapter-2.md'), 'old chapter\n');
    await writeFile(join(sourceDir, 'notes.txt'), 'ignore me\n');

    await copyOutputTree(sourceDir, destinationDir);

    await writeFile(join(sourceDir, 'document.md'), '# v2\n');
    await writeFile(join(sourceDir, 'notes.txt'), 'still ignore\n');
    await unlink(join(sourceDir, 'chapter-2.md'));

    const copied = await copyOutputTree(sourceDir, destinationDir);

    expect(copied).toEqual(['document.md']);
    expect(await readFile(join(destinationDir, 'document.md'), 'utf8')).toContain('v2');
    await expect(stat(join(destinationDir, 'chapter-2.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(stat(join(destinationDir, 'notes.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects an output path that is a file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'inkagent-out-file-'));
    const sourceDir = join(root, 'src');
    const destinationFile = join(root, 'out.md');
    await mkdir(sourceDir);
    await writeFile(join(sourceDir, 'document.md'), '# doc\n');
    await writeFile(destinationFile, 'not a dir');

    await expect(copyOutputTree(sourceDir, destinationFile)).rejects.toThrow(/不是目录/);
  });
});
