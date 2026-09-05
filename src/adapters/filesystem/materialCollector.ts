import type { CollectMaterialsRequest, MaterialCollector } from '../../application/ports.js';
import type { SourceFile } from '../../domain/material.js';
import { InkAgentError } from '../../errors.js';
import { copyInputTree } from './treeFiles.js';

export const fileSystemMaterialCollector: MaterialCollector = {
  collect: collectMaterials,
};

async function collectMaterials(request: CollectMaterialsRequest): Promise<readonly SourceFile[]> {
  const relativePaths = await copyInputTree({
    sourceDirectory: request.inputDirectory,
    targetDirectory: request.workspace.inputDirectory,
    ...(request.inputLimits === undefined ? {} : { limits: request.inputLimits }),
  });
  if (relativePaths.length === 0) {
    throw new InkAgentError(`输入目录中没有可用材料: ${request.inputDirectory}`);
  }
  return relativePaths.map((relativePath) => ({ relativePath }));
}
