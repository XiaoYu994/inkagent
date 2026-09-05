import { join } from 'node:path';

import { createConfiguredDocumentAgent } from './adapters/pi/configuredDocumentAgent.js';
import type { DocumentAgent } from './application/ports.js';
import { defaultInputResourceLimits } from './application/ports.js';
import {
  createDocumentGeneration,
  createDocumentRetry,
  assertValidGenerateDocumentRequest,
  type GenerateDocumentResult as ApplicationGenerateDocumentResult,
} from './application/documentGeneration.js';
import { fileSystemDirectoryValidator } from './adapters/filesystem/directoryValidator.js';
import { fileSystemJobStore } from './adapters/filesystem/jobStore.js';
import { fileSystemMaterialCollector } from './adapters/filesystem/materialCollector.js';
import { anydocMaterialExtractor } from './adapters/ingest/materialExtractor.js';
import { fileSystemOutputPublisher } from './adapters/filesystem/outputPublisher.js';
import type { ThinkingLevel } from './domain/thinkingLevel.js';

export type GenerateDocumentOptions = {
  inputDirectory: string;
  outputDirectory: string;
  brief: string;
  jobStorageDirectory?: string;
  projectDirectory?: string;
  model?: string;
  thinkingLevel?: ThinkingLevel;
  maxInputFiles?: number;
  maxInputFileBytes?: number;
  maxInputTotalBytes?: number;
};

export type GenerateDocumentResult = ApplicationGenerateDocumentResult;

export type RetryDocumentOptions = {
  jobId: string;
  jobStorageDirectory?: string;
  projectDirectory?: string;
  model?: string;
  thinkingLevel?: ThinkingLevel;
};

export async function generateDocument(
  options: GenerateDocumentOptions,
): Promise<GenerateDocumentResult> {
  const projectDirectory = options.projectDirectory ?? process.cwd();
  const jobStorageDirectory =
    options.jobStorageDirectory ?? join(projectDirectory, '.inkagent', 'jobs');
  const inputLimits = createInputResourceLimits(options);
  const request = {
    inputDirectory: options.inputDirectory,
    outputDirectory: options.outputDirectory,
    jobStorageDirectory,
    brief: options.brief,
    ...(inputLimits === undefined ? {} : { inputLimits }),
  };
  assertValidGenerateDocumentRequest(request);
  const documentAgent = await resolveDocumentAgent(options, projectDirectory);

  return createFileSystemDocumentGeneration(documentAgent).execute(request);
}

function createInputResourceLimits(
  options: Pick<
    GenerateDocumentOptions,
    'maxInputFiles' | 'maxInputFileBytes' | 'maxInputTotalBytes'
  >,
) {
  if (
    options.maxInputFiles === undefined &&
    options.maxInputFileBytes === undefined &&
    options.maxInputTotalBytes === undefined
  ) {
    return undefined;
  }
  return {
    maxFiles: options.maxInputFiles ?? defaultInputResourceLimits.maxFiles,
    maxFileBytes: options.maxInputFileBytes ?? defaultInputResourceLimits.maxFileBytes,
    maxTotalBytes: options.maxInputTotalBytes ?? defaultInputResourceLimits.maxTotalBytes,
  };
}

export async function retryDocument(
  options: RetryDocumentOptions,
): Promise<GenerateDocumentResult> {
  const projectDirectory = options.projectDirectory ?? process.cwd();
  const jobStorageDirectory =
    options.jobStorageDirectory ?? join(projectDirectory, '.inkagent', 'jobs');
  const documentAgent = createLazyDocumentAgent(() =>
    resolveDocumentAgent(options, projectDirectory),
  );
  return createDocumentRetry(createFileSystemDependencies(documentAgent)).execute({
    jobId: options.jobId,
    jobStorageDirectory,
  });
}

function createLazyDocumentAgent(loadAgent: () => Promise<DocumentAgent>): DocumentAgent {
  let agent: DocumentAgent | undefined;
  return {
    async generate(workspace) {
      agent ??= await loadAgent();
      await agent.generate(workspace);
    },
  };
}

export async function readDocumentJob(
  jobId: string,
  options: Pick<RetryDocumentOptions, 'jobStorageDirectory' | 'projectDirectory'> = {},
) {
  const projectDirectory = options.projectDirectory ?? process.cwd();
  const jobStorageDirectory =
    options.jobStorageDirectory ?? join(projectDirectory, '.inkagent', 'jobs');
  return fileSystemJobStore.getJob(jobId, jobStorageDirectory);
}

export async function listDocumentJobs(
  options: Pick<RetryDocumentOptions, 'jobStorageDirectory' | 'projectDirectory'> = {},
) {
  const projectDirectory = options.projectDirectory ?? process.cwd();
  const jobStorageDirectory =
    options.jobStorageDirectory ?? join(projectDirectory, '.inkagent', 'jobs');
  return fileSystemJobStore.listJobs(jobStorageDirectory);
}

async function resolveDocumentAgent(
  options: Pick<GenerateDocumentOptions, 'model' | 'thinkingLevel'>,
  projectDirectory: string,
): Promise<DocumentAgent> {
  return createConfiguredDocumentAgent(
    {
      ...(options.model === undefined ? {} : { model: options.model }),
      ...(options.thinkingLevel === undefined ? {} : { thinkingLevel: options.thinkingLevel }),
    },
    projectDirectory,
  );
}

function createFileSystemDocumentGeneration(documentAgent: DocumentAgent) {
  return createDocumentGeneration(createFileSystemDependencies(documentAgent));
}

function createFileSystemDependencies(documentAgent: DocumentAgent) {
  return {
    directoryValidator: fileSystemDirectoryValidator,
    jobStore: fileSystemJobStore,
    materialCollector: fileSystemMaterialCollector,
    materialExtractor: anydocMaterialExtractor,
    documentAgent,
    outputPublisher: fileSystemOutputPublisher,
  };
}
