import { join } from 'node:path';

import {
  createAgentSession,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from '@earendil-works/pi-coding-agent';

import { InkAgentError } from '../errors.js';
import type { DocumentAgent } from './documentAgent.js';
import { documentAgentPrompt } from './prompt.js';

export async function createPiDocumentAgent(): Promise<DocumentAgent> {
  return {
    async generate(jobDir: string): Promise<void> {
      await runPiDocumentSession(jobDir);
    },
  };
}

async function runPiDocumentSession(jobDir: string): Promise<void> {
  const modelRuntime = await ModelRuntime.create();
  const available = await modelRuntime.getAvailable();
  if (available.length === 0) {
    throw new InkAgentError('没有可用的模型。请先配置 Pi 的 API 密钥，或运行 `pi auth`。');
  }

  const agentDir = join(jobDir, '.pi-home');
  const settingsManager = SettingsManager.inMemory({});
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

  const { session } = await createAgentSession({
    cwd: jobDir,
    agentDir,
    modelRuntime,
    tools: ['read', 'write', 'edit', 'grep', 'find', 'ls'],
    resourceLoader: loader,
    sessionManager: SessionManager.create(jobDir, join(jobDir, 'sessions')),
    settingsManager,
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
