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

  it('publishes extraction assets referenced by the draft', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-output-'));
    const sourceDirectory = join(rootDirectory, 'draft');
    const assetSourceDirectory = join(rootDirectory, 'extract');
    const targetDirectory = join(rootDirectory, 'published');
    await mkdir(sourceDirectory);
    await mkdir(join(assetSourceDirectory, 'docx', 'a.docx.assets'), { recursive: true });
    await writeFile(
      join(sourceDirectory, 'document.md'),
      '# 终稿\n\n![图](extract/docx/a.docx.assets/image-1.png)\n',
    );
    await writeFile(join(assetSourceDirectory, 'docx', 'a.docx.assets', 'image-1.png'), 'image');

    const result = await fileSystemOutputPublisher.publish({
      sourceDirectory,
      targetDirectory,
      assetSourceDirectory,
    });

    expect(result.files).toEqual(['document.md', 'extract/docx/a.docx.assets/image-1.png']);
    expect(
      await readFile(
        join(targetDirectory, 'extract', 'docx', 'a.docx.assets', 'image-1.png'),
        'utf8',
      ),
    ).toBe('image');
  });

  it('allows local references with a fragment or query string', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-output-'));
    const sourceDirectory = join(rootDirectory, 'draft');
    const assetSourceDirectory = join(rootDirectory, 'extract');
    const targetDirectory = join(rootDirectory, 'published');
    await mkdir(sourceDirectory);
    await mkdir(assetSourceDirectory);
    await writeFile(
      join(sourceDirectory, 'document.md'),
      '[续读](appendix.md#details)\n\n![图](extract/image.png?version=2)\n',
    );
    await writeFile(join(sourceDirectory, 'appendix.md'), '# 附录\n');
    await writeFile(join(assetSourceDirectory, 'image.png'), 'image');

    await expect(
      fileSystemOutputPublisher.publish({ sourceDirectory, targetDirectory, assetSourceDirectory }),
    ).resolves.toMatchObject({
      files: ['appendix.md', 'document.md', 'extract/image.png'],
    });
  });

  it('keeps the previous output when markdown references a missing local file', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-output-'));
    const sourceDirectory = join(rootDirectory, 'draft');
    const targetDirectory = join(rootDirectory, 'published');
    await mkdir(sourceDirectory);
    await mkdir(targetDirectory);
    await writeFile(join(sourceDirectory, 'document.md'), '![图](missing.png)\n');
    await writeFile(join(targetDirectory, 'previous.md'), '# 保留\n');

    await expect(
      fileSystemOutputPublisher.publish({ sourceDirectory, targetDirectory }),
    ).rejects.toThrow('引用了不存在的本地文件');
    expect(await readFile(join(targetDirectory, 'previous.md'), 'utf8')).toBe('# 保留\n');
  });

  it('rejects markdown references that escape the published directory', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-output-'));
    const sourceDirectory = join(rootDirectory, 'draft');
    const targetDirectory = join(rootDirectory, 'published');
    await mkdir(sourceDirectory);
    await mkdir(targetDirectory);
    await writeFile(join(rootDirectory, 'secret.txt'), 'secret');
    await writeFile(join(sourceDirectory, 'document.md'), '![机密](../secret.txt)\n');
    await writeFile(join(targetDirectory, 'previous.md'), '# 保留\n');

    await expect(
      fileSystemOutputPublisher.publish({ sourceDirectory, targetDirectory }),
    ).rejects.toThrow('引用了发布目录之外的本地文件');
    expect(await readFile(join(targetDirectory, 'previous.md'), 'utf8')).toBe('# 保留\n');
  });
});
