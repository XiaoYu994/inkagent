import { describe, expect, it } from 'vitest';

import { createDocumentGeneration, createDocumentRetry } from './documentGeneration.js';
import type {
  DocumentJob,
  DocumentWorkspace,
  GenerationDirectoryValidator,
  JobStore,
  MaterialCollector,
  MaterialExtractor,
  OutputPublisher,
} from './ports.js';

describe('createDocumentGeneration', () => {
  it('executes the job phases in order and returns published files', async () => {
    const events: string[] = [];
    const workspace = createWorkspace();
    const generation = createDocumentGeneration({
      directoryValidator: createDirectoryValidator(events),
      jobStore: createJobStore(events, workspace),
      materialCollector: createMaterialCollector(events),
      materialExtractor: createMaterialExtractor(events),
      documentAgent: {
        async generate() {
          events.push('generate');
        },
      },
      outputPublisher: createOutputPublisher(events),
    });

    const result = await generation.execute({
      inputDirectory: '/input',
      outputDirectory: '/output',
      jobStorageDirectory: '/jobs',
      brief: '  写文档  ',
    });

    expect(events).toEqual([
      'validate',
      'create',
      'collecting',
      'collect',
      'extracting',
      'extract',
      'record-extractions',
      'generating',
      'generate',
      'publishing',
      'publish',
      'succeeded',
    ]);
    expect(result).toEqual({
      job: expect.objectContaining({ id: 'job-1', phase: 'succeeded' }),
      outputDirectory: '/output',
      outputFiles: ['document.md'],
    });
  });

  it('does not call the agent when no material was extracted', async () => {
    const events: string[] = [];
    const generation = createDocumentGeneration({
      directoryValidator: createDirectoryValidator(events),
      jobStore: createJobStore(events, createWorkspace()),
      materialCollector: {
        async collect() {
          return [{ relativePath: 'broken.pdf' }];
        },
      },
      materialExtractor: {
        async extract() {
          return [
            {
              sourcePath: 'broken.pdf',
              kind: 'pdf',
              status: 'error' as const,
              errorMessage: '解析失败',
            },
          ];
        },
      },
      documentAgent: {
        async generate() {
          events.push('generate');
        },
      },
      outputPublisher: createOutputPublisher(events),
    });

    await expect(
      generation.execute({
        inputDirectory: '/input',
        outputDirectory: '/output',
        jobStorageDirectory: '/jobs',
        brief: '写文档',
      }),
    ).rejects.toThrow('没有可用来生成文档的材料');
    expect(events).not.toContain('generate');
    expect(events).toContain('failed');
  });

  it('rejects an empty directory path before validating or creating a job', async () => {
    const events: string[] = [];
    const generation = createDocumentGeneration({
      directoryValidator: createDirectoryValidator(events),
      jobStore: createJobStore(events, createWorkspace()),
      materialCollector: createMaterialCollector(events),
      materialExtractor: createMaterialExtractor(events),
      documentAgent: { async generate() {} },
      outputPublisher: createOutputPublisher(events),
    });

    await expect(
      generation.execute({
        inputDirectory: '/input',
        outputDirectory: '',
        jobStorageDirectory: '/jobs',
        brief: '写文档',
      }),
    ).rejects.toThrow('输出目录不能为空');
    expect(events).toEqual([]);
  });

  it('keeps the original error when recording the failure also fails', async () => {
    const originalError = new Error('模型调用失败');
    const generation = createDocumentGeneration({
      directoryValidator: createDirectoryValidator([]),
      jobStore: {
        ...createJobStore([], createWorkspace()),
        async failJob() {
          throw new Error('任务记录写入失败');
        },
      },
      materialCollector: createMaterialCollector([]),
      materialExtractor: createMaterialExtractor([]),
      documentAgent: {
        async generate() {
          throw originalError;
        },
      },
      outputPublisher: createOutputPublisher([]),
    });

    await expect(
      generation.execute({
        inputDirectory: '/input',
        outputDirectory: '/output',
        jobStorageDirectory: '/jobs',
        brief: '写文档',
      }),
    ).rejects.toBe(originalError);
  });

  it('retries generation from extracted materials without collecting again', async () => {
    const events: string[] = [];
    const failedJob = {
      ...createJob(createWorkspace()),
      phase: 'failed' as const,
      extractions: [
        {
          sourcePath: 'notes.md',
          kind: 'markdown' as const,
          status: 'ok' as const,
          extractedPath: 'markdown/notes.md',
        },
      ],
      failure: { phase: 'generating' as const, message: '模型失败' },
    };
    const generation = createDocumentRetry({
      directoryValidator: createDirectoryValidator(events),
      jobStore: {
        ...createJobStore(events, failedJob.workspace),
        async getJob() {
          return failedJob;
        },
      },
      materialCollector: {
        async collect() {
          throw new Error('不应重新收集');
        },
      },
      materialExtractor: createMaterialExtractor(events),
      documentAgent: {
        async generate() {
          events.push('generate');
        },
      },
      outputPublisher: createOutputPublisher(events),
    });

    const result = await generation.execute({ jobId: 'job-1', jobStorageDirectory: '/jobs' });

    expect(result.job.phase).toBe('succeeded');
    expect(result.job.failure).toBeUndefined();
    expect(events).toEqual([
      'acquire-job-lock',
      'resume-generating',
      'clear-draft',
      'generate',
      'publishing',
      'publish',
      'succeeded',
      'release-job-lock',
    ]);
  });

  it('allows only one concurrent retry to hold a job lock', async () => {
    const failedJob = {
      ...createJob(createWorkspace()),
      phase: 'failed' as const,
      extractions: [
        {
          sourcePath: 'notes.md',
          kind: 'markdown' as const,
          status: 'ok' as const,
          extractedPath: 'markdown/notes.md',
        },
      ],
      failure: { phase: 'publishing' as const, message: '发布失败' },
    };
    let locked = false;
    const publicationGate = createDeferred<void>();
    const publicationStarted = createDeferred<void>();
    const events: string[] = [];
    const generation = createDocumentRetry({
      directoryValidator: createDirectoryValidator([]),
      jobStore: {
        ...createJobStore(events, failedJob.workspace),
        async getJob() {
          return failedJob;
        },
        async acquireJobLock() {
          if (locked) {
            throw new Error(`任务 ${failedJob.id} 正在执行恢复`);
          }
          locked = true;
          return {
            async release() {
              locked = false;
            },
          };
        },
      },
      materialCollector: createMaterialCollector([]),
      materialExtractor: createMaterialExtractor([]),
      documentAgent: { async generate() {} },
      outputPublisher: {
        async publish() {
          publicationStarted.resolve();
          await publicationGate.promise;
          return { files: ['document.md'] };
        },
      },
    });

    const firstRetry = generation.execute({ jobId: 'job-1', jobStorageDirectory: '/jobs' });
    await publicationStarted.promise;

    await expect(
      generation.execute({ jobId: 'job-1', jobStorageDirectory: '/jobs' }),
    ).rejects.toThrow('正在执行恢复');
    expect(events).not.toContain('failed');

    publicationGate.resolve();
    await expect(firstRetry).resolves.toMatchObject({ job: { phase: 'succeeded' } });
  });
});

function createDeferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createWorkspace(): DocumentWorkspace {
  return {
    rootDirectory: '/jobs/job-1',
    inputDirectory: '/jobs/job-1/input',
    extractionDirectory: '/jobs/job-1/extract',
    draftDirectory: '/jobs/job-1/draft',
    briefFile: '/jobs/job-1/brief.md',
    manifestFile: '/jobs/job-1/manifest.json',
  };
}

function createDirectoryValidator(events: string[]): GenerationDirectoryValidator {
  return {
    async validate() {
      events.push('validate');
    },
  };
}

function createJobStore(events: string[], workspace: DocumentWorkspace): JobStore {
  return {
    async createJob() {
      events.push('create');
      return createJob(workspace);
    },
    async getJob() {
      return createJob(workspace);
    },
    async listJobs() {
      return [];
    },
    async updateJobPhase({ job, phase }) {
      events.push(phase);
      return { ...job, phase };
    },
    async resumeGenerating(job) {
      events.push('resume-generating');
      const resumedJob = { ...job, phase: 'generating' as const };
      delete resumedJob.failure;
      return resumedJob;
    },
    async clearDraft() {
      events.push('clear-draft');
    },
    async recordExtractions({ job, extractions }) {
      events.push('record-extractions');
      return { ...job, extractions };
    },
    async failJob({ job }) {
      events.push('failed');
      return {
        ...job,
        phase: 'failed' as const,
        failure: { phase: job.phase, message: '失败' },
      };
    },
    async acquireJobLock() {
      events.push('acquire-job-lock');
      return {
        async release() {
          events.push('release-job-lock');
        },
      };
    },
  };
}

function createJob(workspace: DocumentWorkspace): DocumentJob {
  return {
    id: 'job-1',
    phase: 'created',
    workspace,
    outputDirectory: '/output',
    extractions: [],
  };
}

function createMaterialCollector(events: string[]): MaterialCollector {
  return {
    async collect() {
      events.push('collect');
      return [{ relativePath: 'notes.md' }];
    },
  };
}

function createMaterialExtractor(events: string[]): MaterialExtractor {
  return {
    async extract() {
      events.push('extract');
      return [
        {
          sourcePath: 'notes.md',
          kind: 'markdown',
          status: 'ok',
          extractedPath: 'markdown/notes.md',
        },
      ];
    },
  };
}

function createOutputPublisher(events: string[]): OutputPublisher {
  return {
    async publish() {
      events.push('publish');
      return { files: ['document.md'] };
    },
  };
}
