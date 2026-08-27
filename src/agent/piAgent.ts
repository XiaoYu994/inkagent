import { join } from 'node:path';

import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRuntime,
  resolveCliModel,
  SessionManager,
  SettingsManager,
  type ResolveCliModelResult,
} from '@earendil-works/pi-coding-agent';

import type { DocumentAgent } from './documentAgent.js';
import type { ThinkingLevel } from '../projectConfig.js';
import { InkAgentError } from '../errors.js';
import { documentAgentPrompt } from './prompt.js';

export type PiModelSelection = {
  /** "provider/modelId" 或裸 "modelId"；也接受 Pi 支持的 pattern 语法。 */
  model?: string;
  /** 最高优先级档位；缺省时依次取模型 pattern 后缀、Pi 用户全局默认。 */
  thinkingLevel?: ThinkingLevel;
};

export async function createPiDocumentAgent(selection?: PiModelSelection): Promise<DocumentAgent> {
  return {
    async generate(jobDir: string): Promise<void> {
      await runPiDocumentSession(jobDir, selection);
    },
  };
}

async function runPiDocumentSession(jobDir: string, selection: PiModelSelection | undefined) {
  const modelRuntime = await ModelRuntime.create();
  const available = await modelRuntime.getAvailable();
  if (available.length === 0) {
    throw new InkAgentError('没有可用的模型。请先配置 Pi 的 API 密钥，或运行 `pi auth`。');
  }

  // 真实用户全局设置兜底默认模型与 thinking；扩展、技能等仍由隔离的 loader 屏蔽。
  const settingsManager = SettingsManager.create(jobDir, getAgentDir());
  const explicitModel = resolveExplicitModel(modelRuntime, selection?.model);

  const agentDir = join(jobDir, '.pi-home');
  const loader = new DefaultResourceLoader({
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
  await loader.reload();

  const thinkingLevel =
    selection?.thinkingLevel ??
    explicitModel.thinkingLevel ??
    (settingsManager.getGlobalSettings().defaultThinkingLevel as ThinkingLevel | undefined);

  const { session } = await createAgentSession({
    cwd: jobDir,
    agentDir,
    modelRuntime,
    tools: ['read', 'write', 'edit', 'grep', 'find', 'ls'],
    resourceLoader: loader,
    sessionManager: SessionManager.create(jobDir, join(jobDir, 'sessions')),
    settingsManager,
    ...(explicitModel.model === undefined ? {} : { model: explicitModel.model }),
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

function resolveExplicitModel(
  runtime: ModelRuntime,
  reference: string | undefined,
): {
  model?: ResolveCliModelResult['model'];
  thinkingLevel?: ResolveCliModelResult['thinkingLevel'];
} {
  if (reference === undefined) {
    return {};
  }

  const slashIndex = reference.indexOf('/');
  const result = resolveCliModel({
    ...(slashIndex >= 0 ? { cliProvider: reference.slice(0, slashIndex) } : {}),
    cliModel: slashIndex >= 0 ? reference.slice(slashIndex + 1) : reference,
    modelRuntime: runtime,
  });

  if (result.error !== undefined || result.model === undefined) {
    throw new InkAgentError(
      result.error ?? `找不到模型 "${reference}"，可在 inkagent.json 或 --model 中换一个引用。`,
    );
  }
  return result;
}
