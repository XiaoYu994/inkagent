export { InkAgentError } from './errors.js';
export { generateDocument } from './generate.js';
export type { GenerateDocumentOptions, GenerateDocumentResult } from './generate.js';
export type { DocumentAgent } from './agent/documentAgent.js';
export { createStubDocumentAgent } from './agent/stubAgent.js';
export { detectSourceKind } from './ingest/sourceKind.js';
export type { SourceKind } from './ingest/sourceKind.js';
export type { ExtractRecord, ExtractStatus } from './ingest/extract.js';
