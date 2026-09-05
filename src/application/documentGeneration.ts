import type { JobPhase } from '../domain/job.js';
import type { MaterialExtraction } from '../domain/material.js';
import { InkAgentError } from '../errors.js';
import { assertValidInputResourceLimits } from './inputResourceLimits.js';
import type {
  DocumentAgent,
  DocumentJob,
  GenerationDirectoryValidator,
  JobStore,
  MaterialCollector,
  MaterialExtractor,
  OutputPublisher,
  InputResourceLimits,
} from './ports.js';

export type GenerateDocumentRequest = {
  inputDirectory: string;
  outputDirectory: string;
  jobStorageDirectory: string;
  brief: string;
  inputLimits?: InputResourceLimits;
};

export type GenerateDocumentResult = {
  job: DocumentJob;
  outputDirectory: string;
  outputFiles: readonly string[];
};

export type DocumentGenerationDependencies = {
  directoryValidator: GenerationDirectoryValidator;
  jobStore: JobStore;
  materialCollector: MaterialCollector;
  materialExtractor: MaterialExtractor;
  documentAgent: DocumentAgent;
  outputPublisher: OutputPublisher;
};

export type DocumentGeneration = {
  execute(request: GenerateDocumentRequest): Promise<GenerateDocumentResult>;
};

export function createDocumentGeneration(
  dependencies: DocumentGenerationDependencies,
): DocumentGeneration {
  return {
    execute: (request) => new DocumentGenerationRun(dependencies, request).execute(),
  };
}

class DocumentGenerationRun {
  private currentJob: DocumentJob | undefined;

  constructor(
    private readonly dependencies: DocumentGenerationDependencies,
    private readonly request: GenerateDocumentRequest,
  ) {}

  async execute(): Promise<GenerateDocumentResult> {
    try {
      return await this.run();
    } catch (error) {
      await this.recordFailure(error);
      throw error;
    }
  }

  private async run(): Promise<GenerateDocumentResult> {
    const brief = requireBrief(this.request.brief);
    if (this.request.inputLimits !== undefined) {
      assertValidInputResourceLimits(this.request.inputLimits);
    }
    await this.dependencies.directoryValidator.validate(this.request);
    this.currentJob = await this.dependencies.jobStore.createJob({
      jobStorageDirectory: this.request.jobStorageDirectory,
      brief,
      outputDirectory: this.request.outputDirectory,
    });
    await this.collectAndExtractMaterials();
    assertMaterialsUsable(this.getCurrentJob().extractions);
    await this.generateDraft();
    return this.publishDraft();
  }

  private async collectAndExtractMaterials(): Promise<void> {
    await this.advanceTo('collecting');
    const sourceFiles = await this.dependencies.materialCollector.collect({
      inputDirectory: this.request.inputDirectory,
      workspace: this.getCurrentJob().workspace,
      ...(this.request.inputLimits === undefined ? {} : { inputLimits: this.request.inputLimits }),
    });
    await this.advanceTo('extracting');
    const extractions = await this.dependencies.materialExtractor.extract({
      sourceFiles,
      workspace: this.getCurrentJob().workspace,
    });
    this.currentJob = await this.dependencies.jobStore.recordExtractions({
      job: this.getCurrentJob(),
      extractions,
    });
  }

  private async generateDraft(): Promise<void> {
    await this.advanceTo('generating');
    await this.dependencies.documentAgent.generate(this.getCurrentJob().workspace);
  }

  private async publishDraft(): Promise<GenerateDocumentResult> {
    await this.advanceTo('publishing');
    const publishedDraft = await this.dependencies.outputPublisher.publish({
      sourceDirectory: this.getCurrentJob().workspace.draftDirectory,
      targetDirectory: this.request.outputDirectory,
      assetSourceDirectory: this.getCurrentJob().workspace.extractionDirectory,
    });
    await this.advanceTo('succeeded');
    return {
      job: this.getCurrentJob(),
      outputDirectory: this.request.outputDirectory,
      outputFiles: publishedDraft.files,
    };
  }

  private async advanceTo(phase: JobPhase): Promise<void> {
    this.currentJob = await this.dependencies.jobStore.updateJobPhase({
      job: this.getCurrentJob(),
      phase,
    });
  }

  private async recordFailure(error: unknown): Promise<void> {
    if (this.currentJob === undefined) {
      return;
    }
    try {
      this.currentJob = await this.dependencies.jobStore.failJob({
        job: this.currentJob,
        error,
      });
    } catch {
      // Preserve the original generation error when failure reporting cannot be persisted.
    }
  }

  private getCurrentJob(): DocumentJob {
    if (this.currentJob === undefined) {
      throw new InkAgentError('文档任务尚未创建');
    }
    return this.currentJob;
  }
}

export type RetryDocumentRequest = {
  jobId: string;
  jobStorageDirectory: string;
};

export type DocumentRetry = {
  execute(request: RetryDocumentRequest): Promise<GenerateDocumentResult>;
};

export function createDocumentRetry(dependencies: DocumentGenerationDependencies): DocumentRetry {
  return {
    execute: (request) => retryDocument(dependencies, request),
  };
}

async function retryDocument(
  dependencies: DocumentGenerationDependencies,
  request: RetryDocumentRequest,
): Promise<GenerateDocumentResult> {
  let job = await dependencies.jobStore.getJob(request.jobId, request.jobStorageDirectory);
  assertRetryableJob(job);
  try {
    if (job.failure?.phase === 'generating') {
      job = await dependencies.jobStore.updateJobPhase({ job, phase: 'generating' });
      await dependencies.jobStore.clearDraft(job);
      await dependencies.documentAgent.generate(job.workspace);
    }
    job = await dependencies.jobStore.updateJobPhase({ job, phase: 'publishing' });
    const publishedDraft = await dependencies.outputPublisher.publish({
      sourceDirectory: job.workspace.draftDirectory,
      targetDirectory: job.outputDirectory,
      assetSourceDirectory: job.workspace.extractionDirectory,
    });
    job = await dependencies.jobStore.updateJobPhase({ job, phase: 'succeeded' });
    return {
      job,
      outputDirectory: job.outputDirectory,
      outputFiles: publishedDraft.files,
    };
  } catch (error) {
    try {
      job = await dependencies.jobStore.failJob({ job, error });
    } catch {
      // Preserve the operational error when failure reporting cannot be persisted.
    }
    throw error;
  }
}

function assertRetryableJob(job: DocumentJob): void {
  if (job.phase !== 'failed' || job.failure === undefined) {
    throw new InkAgentError(`任务 ${job.id} 当前不可重试: phase=${job.phase}`);
  }
  if (job.failure.phase !== 'generating' && job.failure.phase !== 'publishing') {
    throw new InkAgentError(`任务 ${job.id} 失败于 ${job.failure.phase}，需要重新生成任务`);
  }
  if (job.extractions.every((extraction) => extraction.status !== 'ok')) {
    throw new InkAgentError(`任务 ${job.id} 没有可复用的抽取结果`);
  }
}

function requireBrief(brief: string): string {
  const normalizedBrief = brief.trim();
  if (normalizedBrief.length === 0) {
    throw new InkAgentError('brief 不能为空');
  }
  return normalizedBrief;
}

function assertMaterialsUsable(extractions: readonly MaterialExtraction[]): void {
  if (extractions.some((extraction) => extraction.status === 'ok')) {
    return;
  }
  const details = extractions
    .filter((extraction) => extraction.status !== 'ok')
    .map((extraction) => extraction.errorMessage)
    .join('; ');
  throw new InkAgentError(`没有可用来生成文档的材料。${details}`);
}
