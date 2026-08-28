import type { ExtractMaterialsRequest, MaterialExtractor } from '../../application/ports.js';
import type { MaterialExtraction } from '../../domain/material.js';
import { extractSourceFiles } from '../../ingest/extract.js';

export const anydocMaterialExtractor: MaterialExtractor = {
  extract: extractMaterials,
};

function extractMaterials(
  request: ExtractMaterialsRequest,
): Promise<readonly MaterialExtraction[]> {
  return extractSourceFiles({
    inputDirectory: request.workspace.inputDirectory,
    extractionDirectory: request.workspace.extractionDirectory,
    sourceFiles: request.sourceFiles,
  });
}
