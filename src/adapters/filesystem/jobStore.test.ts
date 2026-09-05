import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

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
      outputDirectory: join(rootDirectory, 'output'),
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
    await expect(fileSystemJobStore.getJob(job.id, jobStorageDirectory)).resolves.toEqual(
      failedJob,
    );
  });

  it('persists absolute workspace and output paths from relative requests', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-job-'));
    const jobStorageDirectory = join(rootDirectory, 'jobs');
    const outputDirectory = join(rootDirectory, 'output');
    const job = await fileSystemJobStore.createJob({
      jobStorageDirectory: relative(process.cwd(), jobStorageDirectory),
      brief: '写一份说明',
      outputDirectory: relative(process.cwd(), outputDirectory),
    });

    expect(job.workspace.rootDirectory).toBe(join(jobStorageDirectory, job.id));
    expect(job.outputDirectory).toBe(outputDirectory);
    await expect(
      fileSystemJobStore.getJob(job.id, relative(process.cwd(), jobStorageDirectory)),
    ).resolves.toEqual(job);
  });

  it('rejects a legacy job without an output directory', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-job-'));
    const jobDirectory = join(rootDirectory, 'jobs', 'legacy');
    await mkdir(jobDirectory, { recursive: true });
    await writeFile(join(jobDirectory, 'job.json'), JSON.stringify({ id: 'legacy' }));

    await expect(fileSystemJobStore.getJob('legacy', join(rootDirectory, 'jobs'))).rejects.toThrow(
      '任务记录格式无效',
    );
  });

  it('rejects a job whose workspace does not match its storage location', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-job-'));
    const jobStorageDirectory = join(rootDirectory, 'jobs');
    const job = await fileSystemJobStore.createJob({
      jobStorageDirectory,
      brief: '生成文档',
      outputDirectory: join(rootDirectory, 'output'),
    });
    const jobFile = join(job.workspace.rootDirectory, 'job.json');
    const storedJob = JSON.parse(await readFile(jobFile, 'utf8'));
    await writeFile(
      jobFile,
      JSON.stringify({
        ...storedJob,
        workspace: { ...storedJob.workspace, draftDirectory: join(rootDirectory, 'outside') },
      }),
    );

    await expect(fileSystemJobStore.getJob(job.id, jobStorageDirectory)).rejects.toThrow(
      '任务工作区无效',
    );
  });

  it('rejects a job whose output directory overlaps job storage', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-job-'));
    const jobStorageDirectory = join(rootDirectory, 'jobs');
    const job = await fileSystemJobStore.createJob({
      jobStorageDirectory,
      brief: '生成文档',
      outputDirectory: join(rootDirectory, 'output'),
    });
    const jobFile = join(job.workspace.rootDirectory, 'job.json');
    const storedJob = JSON.parse(await readFile(jobFile, 'utf8'));
    await writeFile(
      jobFile,
      JSON.stringify({ ...storedJob, outputDirectory: jobStorageDirectory }),
    );

    await expect(fileSystemJobStore.getJob(job.id, jobStorageDirectory)).rejects.toThrow(
      '任务输出目录无效',
    );
  });

  it('rejects a job with an invalid phase or failure record', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-job-'));
    const jobStorageDirectory = join(rootDirectory, 'jobs');
    const job = await fileSystemJobStore.createJob({
      jobStorageDirectory,
      brief: '生成文档',
      outputDirectory: join(rootDirectory, 'output'),
    });
    const jobFile = join(job.workspace.rootDirectory, 'job.json');
    const storedJob = JSON.parse(await readFile(jobFile, 'utf8'));

    await writeFile(jobFile, JSON.stringify({ ...storedJob, phase: 'finished' }));
    await expect(fileSystemJobStore.getJob(job.id, jobStorageDirectory)).rejects.toThrow(
      '任务状态无效',
    );

    await writeFile(
      jobFile,
      JSON.stringify({
        ...storedJob,
        phase: 'failed',
        failure: { phase: 'generating', message: 42 },
      }),
    );
    await expect(fileSystemJobStore.getJob(job.id, jobStorageDirectory)).rejects.toThrow(
      '任务失败记录无效',
    );
  });

  it('rejects a job id that escapes the storage directory', async () => {
    await expect(fileSystemJobStore.getJob('../outside', '/tmp/jobs')).rejects.toThrow(
      '任务 ID 无效',
    );
  });

  it('clears a job draft without removing its workspace', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-job-'));
    const job = await fileSystemJobStore.createJob({
      jobStorageDirectory: join(rootDirectory, 'jobs'),
      brief: '重新生成',
      outputDirectory: join(rootDirectory, 'output'),
    });
    await writeFile(join(job.workspace.draftDirectory, 'stale.md'), '# 旧草稿\n');

    await fileSystemJobStore.clearDraft(job);

    await expect(stat(job.workspace.draftDirectory)).resolves.toMatchObject({
      isDirectory: expect.any(Function),
    });
    await expect(
      readFile(join(job.workspace.draftDirectory, 'stale.md'), 'utf8'),
    ).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(readFile(job.workspace.briefFile, 'utf8')).resolves.toBe('重新生成\n');
  });

  it('resumes a failed job without keeping its previous failure', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-job-'));
    const createdJob = await fileSystemJobStore.createJob({
      jobStorageDirectory: join(rootDirectory, 'jobs'),
      brief: '重新生成',
      outputDirectory: join(rootDirectory, 'output'),
    });
    const failedJob = await fileSystemJobStore.failJob({
      job: { ...createdJob, phase: 'generating' },
      error: new Error('模型失败'),
    });

    const resumedJob = await fileSystemJobStore.resumeGenerating(failedJob);

    expect(resumedJob).toMatchObject({ id: createdJob.id, phase: 'generating' });
    expect(resumedJob.failure).toBeUndefined();
    await expect(
      fileSystemJobStore.getJob(resumedJob.id, join(rootDirectory, 'jobs')),
    ).resolves.toEqual(resumedJob);
  });

  it('lists jobs newest first', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-job-'));
    const jobStorageDirectory = join(rootDirectory, 'jobs');
    await mkdir(jobStorageDirectory);
    const firstJob = await fileSystemJobStore.createJob({
      jobStorageDirectory,
      brief: '第一份',
      outputDirectory: join(rootDirectory, 'first-output'),
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const secondJob = await fileSystemJobStore.createJob({
      jobStorageDirectory,
      brief: '第二份',
      outputDirectory: join(rootDirectory, 'second-output'),
    });

    await expect(fileSystemJobStore.listJobs(jobStorageDirectory)).resolves.toEqual([
      secondJob,
      firstJob,
    ]);
  });

  it('keeps valid jobs visible when another job record is corrupted', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-job-'));
    const jobStorageDirectory = join(rootDirectory, 'jobs');
    await mkdir(jobStorageDirectory);
    const validJob = await fileSystemJobStore.createJob({
      jobStorageDirectory,
      brief: '有效任务',
      outputDirectory: join(rootDirectory, 'output'),
    });
    const corruptedJobDirectory = join(jobStorageDirectory, 'corrupted');
    await mkdir(corruptedJobDirectory);
    await writeFile(join(corruptedJobDirectory, 'job.json'), '{not-json');

    await expect(fileSystemJobStore.listJobs(jobStorageDirectory)).resolves.toEqual([validJob]);
  });
});
