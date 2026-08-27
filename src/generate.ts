import { join } from 'node:path';
import { stat } from 'node:fs/promises';

import { createPiDocumentAgent } from './agent/piAgent.js';
import type { DocumentAgent } from './agent/documentAgent.js';
import { InkAgentError } from './errors.js';
import { extractInputFiles, type ExtractRecord } from './ingest/extract.js';
import { copyInputTree, copyOutputTree } from './job/copyTree.js';
import {
  createJobWorkspace,
  writeBrief,
  writeJsonFile,
  type JobWorkspace,
} from './job/workspace.js';
import { loadProjectConfig, type ThinkingLevel } from './projectConfig.js';

export type GenerateDocumentOptions = {
  inputDir: string;
  outputDir: string;
  brief: string;
  workDir?: string;
  /** 覆盖项目配置与 Pi 全局默认的模型引用，规范形式 "provider/modelId"。 */
  model?: string;
  thinkingLevel?: ThinkingLevel;
  documentAgent?: DocumentAgent;
};

export type GenerateDocumentResult = {
  jobId: string;
  jobDir: string;
  outputDir: string;
  outputFiles: string[];
  extracts: ExtractRecord[];
};

export async function generateDocument(
  options: GenerateDocumentOptions,
): Promise<GenerateDocumentResult> {
  const brief = options.brief.trim();
  if (brief.length === 0) {
    throw new InkAgentError('brief 不能为空');
  }

  await assertInputDirReadable(options.inputDir);

  const workDir = options.workDir ?? join(process.cwd(), '.inkagent', 'jobs');
  const workspace = await createJobWorkspace(workDir);
  const sourcePaths = await copyInputTree(options.inputDir, workspace.inputDir);
  if (sourcePaths.length === 0) {
    throw new InkAgentError(`输入目录中没有可用材料: ${options.inputDir}`);
  }
  const extracts = await extractInputFiles(workspace.inputDir, workspace.extractDir, sourcePaths);

  await writeBrief(workspace, brief);
  await writeManifest(workspace, extracts);

  assertExtractsUsable(extracts);

  const documentAgent = options.documentAgent ?? (await createDefaultAgent(options));
  await documentAgent.generate(workspace.rootDir);

  const outputFiles = await copyOutputTree(workspace.outputDir, options.outputDir);

  return {
    jobId: workspace.jobId,
    jobDir: workspace.rootDir,
    outputDir: options.outputDir,
    outputFiles,
    extracts,
  };
}

async function createDefaultAgent(options: GenerateDocumentOptions): Promise<DocumentAgent> {
  if (options.model === undefined && options.thinkingLevel === undefined) {
    const config = await loadProjectConfig(process.cwd());
    return createPiDocumentAgent(config);
  }

  // 显式选项优优先；缺失的维度仍允许由配置文件补齐。
  const explicit = {
    ...(options.model === undefined ? {} : { model: options.model }),
    ...(options.thinkingLevel === undefined ? {} : { thinkingLevel: options.thinkingLevel }),
  };
  const config = await loadProjectConfig(process.cwd());
  return createPiDocumentAgent({ ...config, ...explicit });
}

async function writeManifest(workspace: JobWorkspace, extracts: ExtractRecord[]): Promise<void> {
  await writeJsonFile(workspace.manifestPath, {
    jobId: workspace.jobId,
    extracts,
  });
}

function assertExtractsUsable(extracts: ExtractRecord[]): void {
  const failedAll = extracts.every((record) => record.status !== 'ok');
  if (failedAll) {
    const details = extracts.map((record) => record.errorMessage ?? record.sourcePath).join('; ');
    throw new InkAgentError(`没有可用来生成文档的材料。${details}`);
  }
}

async function assertInputDirReadable(inputDir: string): Promise<void> {
  let stats;
  try {
    stats = await stat(inputDir);
  } catch (error) {
    throw new InkAgentError(`读取输入目录失败: ${inputDir}`, { cause: error });
  }
  if (!stats.isDirectory()) {
    throw new InkAgentError(`输入路径不是目录: ${inputDir}`);
  }
}
