import { join } from 'node:path';

import { createConfiguredDocumentAgent } from './adapters/pi/configuredDocumentAgent.js';
import type { DocumentAgent } from './application/ports.js';
import {
  createDocumentGeneration,
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

async function resolveDocumentAgent(
  options: GenerateDocumentOptions,
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
  return createDocumentGeneration({
    directoryValidator: fileSystemDirectoryValidator,
    jobStore: fileSystemJobStore,
    materialCollector: fileSystemMaterialCollector,
    materialExtractor: anydocMaterialExtractor,
    documentAgent,
    outputPublisher: fileSystemOutputPublisher,
  });
}
