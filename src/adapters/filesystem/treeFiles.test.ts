import { mkdir, mkdtemp, readFile, stat, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { InkAgentError } from '../../errors.js';
import { copyInputTree, copyMarkdownTree } from './treeFiles.js';

describe('copyInputTree', () => {
  it('copies nested files and skips hidden paths', async () => {
    const sourceDirectory = await mkdtemp(join(tmpdir(), 'inkagent-input-'));
    const targetDirectory = join(sourceDirectory, 'target');
    await mkdir(join(sourceDirectory, 'nested'));
    await writeFile(join(sourceDirectory, 'nested', 'notes.md'), 'notes');
    await writeFile(join(sourceDirectory, '.secret'), 'hidden');

    const copiedFiles = await copyInputTree({ sourceDirectory, targetDirectory });

    expect(copiedFiles).toEqual(['nested/notes.md']);
    expect(await readFile(join(targetDirectory, 'nested', 'notes.md'), 'utf8')).toBe('notes');
  });

  it('follows a file symlink and copies the target content', async () => {
    const sourceDirectory = await mkdtemp(join(tmpdir(), 'inkagent-input-'));
    const targetDirectory = join(sourceDirectory, 'target');
    const externalDirectory = await mkdtemp(join(tmpdir(), 'inkagent-external-'));
    await writeFile(join(externalDirectory, 'notes.md'), '# 真材料\n');
    await symlink(join(externalDirectory, 'notes.md'), join(sourceDirectory, 'link.md'));

    const copiedFiles = await copyInputTree({ sourceDirectory, targetDirectory });

    expect(copiedFiles).toEqual(['link.md']);
    expect(await readFile(join(targetDirectory, 'link.md'), 'utf8')).toContain('真材料');
  });

  it('rejects dangling and directory symlinks', async () => {
    const sourceDirectory = await mkdtemp(join(tmpdir(), 'inkagent-input-'));
    const targetDirectory = join(sourceDirectory, 'target');
    await symlink(join(sourceDirectory, 'missing.md'), join(sourceDirectory, 'broken.md'));

    await expect(copyInputTree({ sourceDirectory, targetDirectory })).rejects.toBeInstanceOf(
      InkAgentError,
    );

    await unlink(join(sourceDirectory, 'broken.md'));
    const externalDirectory = await mkdtemp(join(tmpdir(), 'inkagent-external-'));
    await writeFile(join(externalDirectory, 'secret.md'), 'secret');
    await symlink(externalDirectory, join(sourceDirectory, 'docs'));

    await expect(copyInputTree({ sourceDirectory, targetDirectory })).rejects.toThrow(/非文件路径/);
  });
});

describe('copyMarkdownTree', () => {
  it('copies only visible markdown files', async () => {
    const sourceDirectory = await mkdtemp(join(tmpdir(), 'inkagent-draft-'));
    const targetDirectory = join(sourceDirectory, 'target');
    await writeFile(join(sourceDirectory, 'document.md'), '# 文档\n');
    await writeFile(join(sourceDirectory, 'notes.txt'), 'ignore');
    await mkdir(join(sourceDirectory, '.hidden'));
    await writeFile(join(sourceDirectory, '.hidden', 'secret.md'), 'ignore');

    const copiedFiles = await copyMarkdownTree({ sourceDirectory, targetDirectory });

    expect(copiedFiles).toEqual(['document.md']);
    expect(await readFile(join(targetDirectory, 'document.md'), 'utf8')).toBe('# 文档\n');
  });

  it('rejects a draft without markdown', async () => {
    const sourceDirectory = await mkdtemp(join(tmpdir(), 'inkagent-draft-'));
    const targetDirectory = join(sourceDirectory, 'target');
    await writeFile(join(sourceDirectory, 'notes.txt'), 'not markdown');

    await expect(copyMarkdownTree({ sourceDirectory, targetDirectory })).rejects.toThrow('没有在');
  });

  it('rejects a non-directory source path', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-draft-'));
    const sourceFile = join(rootDirectory, 'draft.md');
    await writeFile(sourceFile, '# draft');

    await expect(
      copyMarkdownTree({
        sourceDirectory: sourceFile,
        targetDirectory: join(rootDirectory, 'out'),
      }),
    ).rejects.toBeInstanceOf(InkAgentError);
    await expect(stat(sourceFile)).resolves.toMatchObject({ isFile: expect.any(Function) });
  });
});
