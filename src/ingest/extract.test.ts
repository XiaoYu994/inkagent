import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { extractInputFiles } from './extract.js';
import { createDocxWithText, createPdfWithText } from './officeFixtures.js';

describe('extractInputFiles', () => {
  it('copies markdown text into extract markdown', async () => {
    const { inputDir, extractDir } = await createDirs();
    await writeFile(join(inputDir, 'notes.md'), '# Title\n\nbody\n');

    const records = await extractInputFiles(inputDir, extractDir, ['notes.md']);

    expect(records[0]?.status).toBe('ok');
    expect(await readFile(join(extractDir, 'notes.md.md'), 'utf8')).toContain('body');
  });

  it('extracts text from a pdf', async () => {
    const { inputDir, extractDir } = await createDirs();
    await writeFile(join(inputDir, 'a.pdf'), createPdfWithText('Hello PDF'));

    const records = await extractInputFiles(inputDir, extractDir, ['a.pdf']);

    expect(records[0]?.status).toBe('ok');
    expect(await readFile(join(extractDir, 'a.pdf.md'), 'utf8')).toContain('Hello PDF');
  });

  it('extracts text from a docx', async () => {
    const { inputDir, extractDir } = await createDirs();
    await writeFile(join(inputDir, 'a.docx'), await createDocxWithText('Hello Docx'));

    const records = await extractInputFiles(inputDir, extractDir, ['a.docx']);

    expect(records[0]?.status).toBe('ok');
    expect(await readFile(join(extractDir, 'a.docx.md'), 'utf8')).toContain('Hello Docx');
  });

  it('extracts a csv table through anydoc', async () => {
    const { inputDir, extractDir } = await createDirs();
    await writeFile(join(inputDir, 'a.csv'), 'name,age\nAda,1\n');

    const records = await extractInputFiles(inputDir, extractDir, ['a.csv']);

    expect(records[0]?.status).toBe('ok');
    expect(await readFile(join(extractDir, 'a.csv.md'), 'utf8')).toMatch(/Ada/);
  });

  it('marks unknown types as unsupported', async () => {
    const { inputDir, extractDir } = await createDirs();
    await writeFile(join(inputDir, 'a.bin'), 'nope');

    const records = await extractInputFiles(inputDir, extractDir, ['a.bin']);

    expect(records[0]?.status).toBe('unsupported');
  });
});

async function createDirs(): Promise<{ inputDir: string; extractDir: string }> {
  const root = await mkdtemp(join(tmpdir(), 'inkagent-extract-'));
  const inputDir = join(root, 'input');
  const extractDir = join(root, 'extract');
  await mkdir(inputDir);
  await mkdir(extractDir);
  return { inputDir, extractDir };
}
