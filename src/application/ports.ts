import type { JobFailure, JobPhase } from '../domain/job.js';
import type { MaterialExtraction, SourceFile } from '../domain/material.js';

export type DocumentWorkspace = {
  rootDirectory: string;
  inputDirectory: string;
  extractionDirectory: string;
  draftDirectory: string;
  briefFile: string;
  manifestFile: string;
};

export type DocumentJob = {
  id: string;
  phase: JobPhase;
  workspace: DocumentWorkspace;
  outputDirectory: string;
  extractions: readonly MaterialExtraction[];
  failure?: JobFailure;
};

export type CreateJobRequest = {
  jobStorageDirectory: string;
  brief: string;
  outputDirectory: string;
};

export type GenerationDirectories = {
  inputDirectory: string;
  jobStorageDirectory: string;
  outputDirectory: string;
};

export type GenerationDirectoryValidator = {
  validate(request: GenerationDirectories): Promise<void>;
};

export type UpdateJobPhaseRequest = {
  job: DocumentJob;
  phase: JobPhase;
};

export type RecordExtractionsRequest = {
  job: DocumentJob;
  extractions: readonly MaterialExtraction[];
};

export type FailJobRequest = {
  job: DocumentJob;
  error: unknown;
};

export type JobStore = {
  createJob(request: CreateJobRequest): Promise<DocumentJob>;
  getJob(jobId: string, jobStorageDirectory: string): Promise<DocumentJob>;
  listJobs(jobStorageDirectory: string): Promise<readonly DocumentJob[]>;
  updateJobPhase(request: UpdateJobPhaseRequest): Promise<DocumentJob>;
  clearDraft(job: DocumentJob): Promise<void>;
  recordExtractions(request: RecordExtractionsRequest): Promise<DocumentJob>;
  failJob(request: FailJobRequest): Promise<DocumentJob>;
};

export type CollectMaterialsRequest = {
  inputDirectory: string;
  workspace: DocumentWorkspace;
  inputLimits?: InputResourceLimits;
};

export type InputResourceLimits = {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
};

export const defaultInputResourceLimits = Object.freeze({
  maxFiles: 1000,
  maxFileBytes: 50 * 1024 * 1024,
  maxTotalBytes: 200 * 1024 * 1024,
}) satisfies Readonly<InputResourceLimits>;

export type MaterialCollector = {
  collect(request: CollectMaterialsRequest): Promise<readonly SourceFile[]>;
};

export type ExtractMaterialsRequest = {
  sourceFiles: readonly SourceFile[];
  workspace: DocumentWorkspace;
};

export type MaterialExtractor = {
  extract(request: ExtractMaterialsRequest): Promise<readonly MaterialExtraction[]>;
};

export type DocumentAgent = {
  generate(workspace: DocumentWorkspace): Promise<void>;
};

export type PublishDraftRequest = {
  sourceDirectory: string;
  targetDirectory: string;
  assetSourceDirectory?: string;
};

export type PublishedDraft = {
  files: readonly string[];
};

export type OutputPublisher = {
  publish(request: PublishDraftRequest): Promise<PublishedDraft>;
};
