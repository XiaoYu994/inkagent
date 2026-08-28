import type { JobPhase } from '../domain/job.js';
import type { MaterialExtraction } from '../domain/material.js';
import { InkAgentError } from '../errors.js';
import type {
  DocumentAgent,
  DocumentJob,
  GenerationDirectoryValidator,
  JobStore,
  MaterialCollector,
  MaterialExtractor,
  OutputPublisher,
} from './ports.js';

export type GenerateDocumentRequest = {
  inputDirectory: string;
  outputDirectory: string;
  jobStorageDirectory: string;
  brief: string;
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
    await this.dependencies.directoryValidator.validate(this.request);
    this.currentJob = await this.dependencies.jobStore.createJob({
      jobStorageDirectory: this.request.jobStorageDirectory,
      brief,
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
    this.currentJob = await this.dependencies.jobStore.failJob({
      job: this.currentJob,
      error,
    });
  }

  private getCurrentJob(): DocumentJob {
    if (this.currentJob === undefined) {
      throw new InkAgentError('文档任务尚未创建');
    }
    return this.currentJob;
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
