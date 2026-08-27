import { join } from 'node:path';

import {
  createAgentSession,
  DefaultResourceLoader,
  ModelRuntime,
  resolveCliModel,
  SessionManager,
  SettingsManager,
  type ResolveCliModelResult,
} from '@earendil-works/pi-coding-agent';

import type { DocumentAgent } from './documentAgent.js';
import { createJobBoundTools, jobBoundToolNames } from './jobTools.js';
import type { ThinkingLevel } from '../projectConfig.js';
import { InkAgentError } from '../errors.js';
import { documentAgentPrompt } from './prompt.js';

export type PiModelSelection = {
  model: string;
  thinkingLevel?: ThinkingLevel;
};

export async function createPiDocumentAgent(selection: PiModelSelection): Promise<DocumentAgent> {
  return {
    async generate(jobDir: string): Promise<void> {
      await runPiDocumentSession(jobDir, selection);
    },
  };
}

export async function listAvailableModelIds(): Promise<string[]> {
  const { available } = await createAuthenticatedModelRuntime();
  return available.map((model) => `${model.provider}/${model.id}`).sort();
}

async function runPiDocumentSession(jobDir: string, selection: PiModelSelection) {
  const { modelRuntime, available } = await createAuthenticatedModelRuntime();
  const explicitModel = resolveExplicitModel(modelRuntime, selection.model);
  assertModelHasAuth(explicitModel.model, available, selection.model);

  const { agentDir, settingsManager, resourceLoader } = await createJobAgentResources(jobDir);
  const thinkingLevel = selection.thinkingLevel ?? explicitModel.thinkingLevel;
  const { session } = await createAgentSession({
    cwd: jobDir,
    agentDir,
    modelRuntime,
    tools: jobBoundToolNames(),
    customTools: createJobBoundTools(jobDir),
    resourceLoader,
    sessionManager: SessionManager.create(jobDir, join(jobDir, 'sessions')),
    settingsManager,
    model: explicitModel.model,
    ...(thinkingLevel === undefined ? {} : { thinkingLevel }),
  });

  try {
    await session.prompt(
      '阅读 brief.md 与 extract/ 下的材料，在 output/ 写出 Markdown 终稿。默认文件为 output/document.md。',
    );
  } catch (error) {
    throw new InkAgentError('Pi 生成文档失败', { cause: error });
  } finally {
    session.dispose();
  }
}

async function createAuthenticatedModelRuntime(): Promise<{
  modelRuntime: ModelRuntime;
  available: Awaited<ReturnType<ModelRuntime['getAvailable']>>;
}> {
  const modelRuntime = await ModelRuntime.create();
  const available = await modelRuntime.getAvailable();
  if (available.length === 0) {
    throw new InkAgentError('没有可用的模型。请先配置 API 密钥（环境变量或 `pi auth`）。');
  }
  return { modelRuntime, available };
}

async function createJobAgentResources(jobDir: string) {
  const agentDir = join(jobDir, '.pi-home');
  const settingsManager = SettingsManager.inMemory({});
  const resourceLoader = new DefaultResourceLoader({
    cwd: jobDir,
    agentDir,
    settingsManager,
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPrompt: documentAgentPrompt,
  });
  await resourceLoader.reload();
  return { agentDir, settingsManager, resourceLoader };
}

function resolveExplicitModel(
  runtime: ModelRuntime,
  reference: string,
): {
  model: NonNullable<ResolveCliModelResult['model']>;
  thinkingLevel?: ResolveCliModelResult['thinkingLevel'];
} {
  const result = resolveCliModel({
    cliModel: reference,
    modelRuntime: runtime,
  });

  if (result.warning !== undefined) {
    process.stderr.write(`${result.warning}\n`);
  }

  if (result.error !== undefined || result.model === undefined) {
    throw new InkAgentError(
      result.error ?? `找不到模型 "${reference}"，可在 inkagent.json 或 --model 中换一个引用。`,
    );
  }
  if (result.thinkingLevel === undefined) {
    return { model: result.model };
  }
  return { model: result.model, thinkingLevel: result.thinkingLevel };
}

function assertModelHasAuth(
  model: NonNullable<ResolveCliModelResult['model']>,
  available: readonly { provider: string; id: string }[],
  reference: string,
): void {
  const hasAuth = available.some(
    (candidate) => candidate.provider === model.provider && candidate.id === model.id,
  );
  if (!hasAuth) {
    throw new InkAgentError(
      `模型 "${reference}" 没有可用的 API 密钥。请设置对应环境变量，或运行 \`pi auth\`。`,
    );
  }
}
