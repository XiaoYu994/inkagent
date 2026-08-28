import type { DocumentAgent } from '../../application/ports.js';
import { readProjectConfig, type ProjectConfig } from '../../config/projectConfig.js';
import { InkAgentError } from '../../errors.js';
import { createPiDocumentAgent, type PiDocumentAgentOptions } from './documentAgent.js';
import { listAvailableModelIds } from './modelRuntime.js';

export type DocumentAgentOptions = {
  model?: string;
  thinkingLevel?: ProjectConfig['thinkingLevel'];
};

export async function createConfiguredDocumentAgent(
  options: DocumentAgentOptions,
  projectDirectory: string,
): Promise<DocumentAgent> {
  const config = await readProjectConfig(projectDirectory);
  return createPiDocumentAgent(resolvePiOptions(options, config));
}

export async function listProjectModelIds(projectDirectory: string): Promise<string[]> {
  const config = await readProjectConfig(projectDirectory);
  return listAvailableModelIds(config?.pi?.providers);
}

export function resolvePiOptions(
  options: DocumentAgentOptions,
  config: ProjectConfig | undefined,
): PiDocumentAgentOptions {
  const model = options.model ?? config?.model;
  if (model === undefined) {
    throw new InkAgentError(
      '必须指定模型：使用 --model provider/modelId，或在 inkagent.json 中设置 model',
    );
  }
  const thinkingLevel = options.thinkingLevel ?? config?.thinkingLevel;
  return {
    model,
    ...(thinkingLevel === undefined ? {} : { thinkingLevel }),
    ...(config?.pi?.providers === undefined ? {} : { providers: config.pi.providers }),
  };
}
