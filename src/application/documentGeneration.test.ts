import { describe, expect, it } from 'vitest';

import { createDocumentGeneration } from './documentGeneration.js';
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
});

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
    async updateJobPhase({ job, phase }) {
      events.push(phase);
      return { ...job, phase };
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
  };
}

function createJob(workspace: DocumentWorkspace): DocumentJob {
  return {
    id: 'job-1',
    phase: 'created',
    workspace,
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
