export { InkAgentError } from './errors.js';
export { generateDocument } from './generate.js';
export type { GenerateDocumentOptions, GenerateDocumentResult } from './generate.js';
export { createDocumentGeneration } from './application/documentGeneration.js';
export type {
  DocumentGeneration,
  DocumentGenerationDependencies,
  GenerateDocumentRequest as DocumentGenerationRequest,
} from './application/documentGeneration.js';
export type {
  DocumentAgent,
  DocumentWorkspace,
  GenerationDirectoryValidator,
  JobStore,
  MaterialCollector,
  MaterialExtractor,
  OutputPublisher,
} from './application/ports.js';
export type { DocumentJob } from './application/ports.js';
export type { JobPhase, JobFailure } from './domain/job.js';
export { detectSourceKind } from './ingest/sourceKind.js';
export type {
  SourceFile,
  SourceKind,
  MaterialExtraction,
  MaterialExtractionStatus,
} from './domain/material.js';
export type { ThinkingLevel } from './domain/thinkingLevel.js';
