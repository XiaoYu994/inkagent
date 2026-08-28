import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { fileSystemJobStore } from './jobStore.js';

describe('fileSystemJobStore', () => {
  it('creates and persists a job through its lifecycle', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-job-'));
    const jobStorageDirectory = join(rootDirectory, 'jobs');
    await mkdir(jobStorageDirectory);

    let job = await fileSystemJobStore.createJob({
      jobStorageDirectory,
      brief: '写一份说明',
    });
    expect(await readFile(job.workspace.briefFile, 'utf8')).toBe('写一份说明\n');

    job = await fileSystemJobStore.updateJobPhase({ job, phase: 'extracting' });
    job = await fileSystemJobStore.recordExtractions({
      job,
      extractions: [
        {
          sourcePath: 'notes.md',
          kind: 'markdown',
          status: 'ok',
          extractedPath: 'markdown/notes.md',
        },
      ],
    });
    const failedJob = await fileSystemJobStore.failJob({
      job,
      error: new Error('测试失败'),
    });

    expect(failedJob.phase).toBe('failed');
    expect(failedJob.failure).toEqual({ phase: 'extracting', message: '测试失败' });
    expect(
      JSON.parse(await readFile(join(job.workspace.rootDirectory, 'job.json'), 'utf8')),
    ).toEqual(failedJob);
  });
});
