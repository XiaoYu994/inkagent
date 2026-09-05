import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { extractSourceFiles } from './extract.js';
import {
  createDocxWithParagraphs,
  createDocxWithText,
  createPdfWithText,
} from './officeFixtures.js';

describe('extractSourceFiles', () => {
  it('rejects source paths that escape the input directory', async () => {
    const { inputDirectory, extractionDirectory } = await createDirectories();

    await expect(
      extractSourceFiles({
        inputDirectory,
        extractionDirectory,
        sourceFiles: [{ relativePath: '../../outside.txt' }],
      }),
    ).rejects.toThrow('材料路径无效');
  });

  it('keeps a .markdown source name without appending another .md', async () => {
    const { inputDirectory, extractionDirectory } = await createDirectories();
    await writeFile(join(inputDirectory, 'notes.markdown'), '# Title\n\nbody\n');

    const records = await extractSourceFiles({
      inputDirectory,
      extractionDirectory,
      sourceFiles: [{ relativePath: 'notes.markdown' }],
    });

    const extraction = records[0];
    expect(extraction?.status).toBe('ok');
    if (extraction?.status !== 'ok') {
      throw new Error('notes.markdown should be extracted');
    }
    expect(extraction.extractedPath).toBe('markdown/notes.markdown');
    expect(
      await readFile(join(extractionDirectory, 'markdown', 'notes.markdown'), 'utf8'),
    ).toContain('body');
  });

  it('copies markdown text into extract markdown', async () => {
    const { inputDirectory, extractionDirectory } = await createDirectories();
    await writeFile(join(inputDirectory, 'notes.md'), '# Title\n\nbody\n');

    const records = await extractSourceFiles({
      inputDirectory,
      extractionDirectory,
      sourceFiles: [{ relativePath: 'notes.md' }],
    });

    expect(records[0]?.status).toBe('ok');
    expect(await readFile(join(extractionDirectory, 'markdown', 'notes.md'), 'utf8')).toContain(
      'body',
    );
  });

  it('extracts text from a pdf', async () => {
    const { inputDirectory, extractionDirectory } = await createDirectories();
    await writeFile(join(inputDirectory, 'a.pdf'), createPdfWithText('Hello PDF'));

    const records = await extractSourceFiles({
      inputDirectory,
      extractionDirectory,
      sourceFiles: [{ relativePath: 'a.pdf' }],
    });

    expect(records[0]?.status).toBe('ok');
    expect(await readFile(join(extractionDirectory, 'pdf', 'a.pdf.md'), 'utf8')).toContain(
      'Hello PDF',
    );
  });

  it('drops consecutive drawing fragments from a docx and keeps the caption', async () => {
    const { inputDirectory, extractionDirectory } = await createDirectories();
    await writeFile(
      join(inputDirectory, 'chart.docx'),
      await createDocxWithParagraphs([
        'PSD',
        '(g2/Hz)',
        'f',
        '(Hz)',
        '2000',
        '振动谱形图如图2所示。',
      ]),
    );

    const records = await extractSourceFiles({
      inputDirectory,
      extractionDirectory,
      sourceFiles: [{ relativePath: 'chart.docx' }],
    });
    const markdown = await readFile(join(extractionDirectory, 'docx', 'chart.docx.md'), 'utf8');

    expect(records[0]?.status).toBe('ok');
    expect(markdown).toContain('振动谱形图如图2所示。');
    expect(markdown).not.toContain('PSD');
    expect(markdown).not.toContain('layout-debris');
  });

  it('extracts text from a docx', async () => {
    const { inputDirectory, extractionDirectory } = await createDirectories();
    await writeFile(join(inputDirectory, 'a.docx'), await createDocxWithText('Hello Docx'));

    const records = await extractSourceFiles({
      inputDirectory,
      extractionDirectory,
      sourceFiles: [{ relativePath: 'a.docx' }],
    });

    expect(records[0]?.status).toBe('ok');
    expect(await readFile(join(extractionDirectory, 'docx', 'a.docx.md'), 'utf8')).toContain(
      'Hello Docx',
    );
  });

  it('extracts a csv table through anydoc', async () => {
    const { inputDirectory, extractionDirectory } = await createDirectories();
    await writeFile(join(inputDirectory, 'a.csv'), 'name,age\nAda,1\n');

    const records = await extractSourceFiles({
      inputDirectory,
      extractionDirectory,
      sourceFiles: [{ relativePath: 'a.csv' }],
    });

    expect(records[0]?.status).toBe('ok');
    expect(await readFile(join(extractionDirectory, 'csv', 'a.csv.md'), 'utf8')).toMatch(/Ada/);
  });

  it('copies an image through unchanged and marks the record ok', async () => {
    const { inputDirectory, extractionDirectory } = await createDirectories();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await writeFile(join(inputDirectory, 'logo.png'), png);

    const records = await extractSourceFiles({
      inputDirectory,
      extractionDirectory,
      sourceFiles: [{ relativePath: 'logo.png' }],
    });

    expect(records[0]).toMatchObject({
      status: 'ok',
      kind: 'image',
      extractedPath: 'image/logo.png',
    });
    expect(await readFile(join(extractionDirectory, 'image', 'logo.png'))).toEqual(png);
  });

  it('marks unknown types as unsupported', async () => {
    const { inputDirectory, extractionDirectory } = await createDirectories();
    await writeFile(join(inputDirectory, 'a.bin'), 'nope');

    const records = await extractSourceFiles({
      inputDirectory,
      extractionDirectory,
      sourceFiles: [{ relativePath: 'a.bin' }],
    });

    expect(records[0]?.status).toBe('unsupported');
  });

  it('marks empty text files as extraction errors', async () => {
    const { inputDirectory, extractionDirectory } = await createDirectories();
    await writeFile(join(inputDirectory, 'empty.txt'), ' \n');

    const records = await extractSourceFiles({
      inputDirectory,
      extractionDirectory,
      sourceFiles: [{ relativePath: 'empty.txt' }],
    });

    expect(records[0]).toMatchObject({
      sourcePath: 'empty.txt',
      kind: 'plain-text',
      status: 'error',
      errorMessage: expect.stringContaining('文件内容为空'),
    });
  });
});

async function createDirectories(): Promise<{
  inputDirectory: string;
  extractionDirectory: string;
}> {
  const root = await mkdtemp(join(tmpdir(), 'inkagent-extract-'));
  const inputDirectory = join(root, 'input');
  const extractionDirectory = join(root, 'extract');
  await mkdir(inputDirectory);
  await mkdir(extractionDirectory);
  return { inputDirectory, extractionDirectory };
}
