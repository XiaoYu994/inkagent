import { mkdir, readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { fileSystemDirectoryValidator } from './adapters/filesystem/directoryValidator.js';
import { fileSystemJobStore } from './adapters/filesystem/jobStore.js';
import { fileSystemMaterialCollector } from './adapters/filesystem/materialCollector.js';
import { fileSystemOutputPublisher } from './adapters/filesystem/outputPublisher.js';
import { anydocMaterialExtractor } from './adapters/ingest/materialExtractor.js';
import { createDocumentGeneration } from './application/documentGeneration.js';

describe('document generation', () => {
  it('generates a markdown document and persists the completed job', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-generation-'));
    const inputDirectory = join(rootDirectory, 'input');
    const outputDirectory = join(rootDirectory, 'output');
    const jobStorageDirectory = join(rootDirectory, 'jobs');
    await mkdir(inputDirectory);
    await writeFile(join(inputDirectory, 'notes.md'), '# 材料\n\n正文\n');

    const generation = createDocumentGeneration({
      directoryValidator: fileSystemDirectoryValidator,
      jobStore: fileSystemJobStore,
      materialCollector: fileSystemMaterialCollector,
      materialExtractor: anydocMaterialExtractor,
      documentAgent: {
        async generate(workspace) {
          await writeFile(join(workspace.draftDirectory, 'document.md'), '# 终稿\n');
        },
      },
      outputPublisher: fileSystemOutputPublisher,
    });

    const result = await generation.execute({
      inputDirectory,
      outputDirectory,
      jobStorageDirectory,
      brief: '根据材料生成文档',
    });

    expect(result.job.phase).toBe('succeeded');
    expect(result.outputFiles).toEqual(['document.md']);
    expect(await readFile(join(outputDirectory, 'document.md'), 'utf8')).toBe('# 终稿\n');
    expect(result.job.extractions).toMatchObject([
      { sourcePath: 'notes.md', status: 'ok', extractedPath: 'markdown/notes.md' },
    ]);
    expect(
      JSON.parse(await readFile(join(result.job.workspace.rootDirectory, 'job.json'), 'utf8')),
    ).toMatchObject({ phase: 'succeeded' });
  });

  it('records a failed job when no source can be extracted', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-generation-'));
    const inputDirectory = join(rootDirectory, 'input');
    const outputDirectory = join(rootDirectory, 'output');
    const jobStorageDirectory = join(rootDirectory, 'jobs');
    await mkdir(inputDirectory);
    await writeFile(join(inputDirectory, 'archive.zip'), 'not supported');

    const generation = createDocumentGeneration({
      directoryValidator: fileSystemDirectoryValidator,
      jobStore: fileSystemJobStore,
      materialCollector: fileSystemMaterialCollector,
      materialExtractor: anydocMaterialExtractor,
      documentAgent: {
        async generate() {
          throw new Error('不应调用 Agent');
        },
      },
      outputPublisher: fileSystemOutputPublisher,
    });

    await expect(
      generation.execute({
        inputDirectory,
        outputDirectory,
        jobStorageDirectory,
        brief: '生成文档',
      }),
    ).rejects.toThrow('没有可用来生成文档的材料');
  });
});
