import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { fileSystemOutputPublisher } from './outputPublisher.js';

describe('fileSystemOutputPublisher', () => {
  it('replaces stale output only after a valid draft has been staged', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-output-'));
    const sourceDirectory = join(rootDirectory, 'draft');
    const targetDirectory = join(rootDirectory, 'published');
    await mkdir(sourceDirectory);
    await mkdir(targetDirectory);
    await writeFile(join(sourceDirectory, 'document.md'), '# 新稿\n');
    await writeFile(join(targetDirectory, 'stale.md'), '# 旧稿\n');

    const result = await fileSystemOutputPublisher.publish({
      sourceDirectory,
      targetDirectory,
    });

    expect(result.files).toEqual(['document.md']);
    expect(await readFile(join(targetDirectory, 'document.md'), 'utf8')).toBe('# 新稿\n');
    await expect(stat(join(targetDirectory, 'stale.md'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('keeps the previous output when the draft has no markdown', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-output-'));
    const sourceDirectory = join(rootDirectory, 'draft');
    const targetDirectory = join(rootDirectory, 'published');
    await mkdir(sourceDirectory);
    await mkdir(targetDirectory);
    await writeFile(join(sourceDirectory, 'notes.txt'), 'not markdown');
    await writeFile(join(targetDirectory, 'previous.md'), '# 保留\n');

    await expect(
      fileSystemOutputPublisher.publish({ sourceDirectory, targetDirectory }),
    ).rejects.toThrow('没有在');
    expect(await readFile(join(targetDirectory, 'previous.md'), 'utf8')).toBe('# 保留\n');
  });
});
