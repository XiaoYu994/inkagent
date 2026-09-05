import { join } from 'node:path';

import { createConfiguredDocumentAgent } from './adapters/pi/configuredDocumentAgent.js';
import type { DocumentAgent } from './application/ports.js';
import {
  createDocumentGeneration,
  createDocumentRetry,
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
  const documentAgent = await resolveDocumentAgent(options, projectDirectory);
  const jobStorageDirectory =
    options.jobStorageDirectory ?? join(projectDirectory, '.inkagent', 'jobs');

  return createFileSystemDocumentGeneration(documentAgent).execute({
    inputDirectory: options.inputDirectory,
    outputDirectory: options.outputDirectory,
    jobStorageDirectory,
    brief: options.brief,
  });
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
