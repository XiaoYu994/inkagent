import { join, relative } from 'node:path';

import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
} from '@earendil-works/pi-coding-agent';

import type { DocumentAgent, DocumentWorkspace } from '../../application/ports.js';
import { InkAgentError } from '../../errors.js';
import { createDocumentTools, getDocumentToolNames } from './jobTools.js';
import { resolveAuthenticatedModel, type PiModel } from './modelRuntime.js';
import { documentAgentSystemPrompt } from './prompt.js';
import type { ThinkingLevel } from '../../domain/thinkingLevel.js';

export type PiDocumentAgentOptions = {
  model: string;
  thinkingLevel?: ThinkingLevel;
  providers?: Record<string, unknown>;
};

export function createPiDocumentAgent(options: PiDocumentAgentOptions): DocumentAgent {
  return {
    generate: (workspace) => generateDocument(workspace, options),
  };
}

async function generateDocument(
  workspace: DocumentWorkspace,
  options: PiDocumentAgentOptions,
): Promise<void> {
  const resolvedModel = await resolveAuthenticatedModel(options.model, options.providers);
  const session = await createPiSession({
    workspace,
    resolvedModel,
    thinkingLevel: options.thinkingLevel,
  });
  try {
    await session.prompt(createGenerationPrompt(workspace));
  } catch (error) {
    throw new InkAgentError('Pi 生成文档失败', { cause: error });
  } finally {
    session.dispose();
  }
}

type CreatePiSessionRequest = {
  workspace: DocumentWorkspace;
  resolvedModel: PiModel;
  thinkingLevel: ThinkingLevel | undefined;
};

async function createPiSession({
  workspace,
  resolvedModel,
  thinkingLevel,
}: CreatePiSessionRequest) {
  const agentDirectory = join(workspace.rootDirectory, '.pi-home');
  const settingsManager = SettingsManager.inMemory({});
  const resourceLoader = new DefaultResourceLoader({
    cwd: workspace.rootDirectory,
    agentDir: agentDirectory,
    settingsManager,
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPrompt: documentAgentSystemPrompt,
  });
  await resourceLoader.reload();

  const { session } = await createAgentSession({
    cwd: workspace.rootDirectory,
    agentDir: agentDirectory,
    modelRuntime: resolvedModel.runtime,
    tools: getDocumentToolNames(),
    customTools: createDocumentTools(workspace.rootDirectory, workspace.draftDirectory),
    resourceLoader,
    sessionManager: SessionManager.create(
      workspace.rootDirectory,
      join(workspace.rootDirectory, 'sessions'),
    ),
    settingsManager,
    model: resolvedModel.model,
    ...(thinkingLevel === undefined ? {} : { thinkingLevel }),
  });
  return session;
}

function createGenerationPrompt(workspace: DocumentWorkspace): string {
  const pathFromWorkspace = (path: string): string =>
    relative(workspace.rootDirectory, path) || '.';
  return [
    `阅读 ${pathFromWorkspace(workspace.briefFile)} 与 ${pathFromWorkspace(workspace.extractionDirectory)} 下的材料。`,
    `在 ${pathFromWorkspace(workspace.draftDirectory)} 写出 Markdown 终稿，默认文件为 ${pathFromWorkspace(join(workspace.draftDirectory, 'document.md'))}。`,
  ].join(' ');
}
