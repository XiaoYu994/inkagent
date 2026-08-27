import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { InkAgentError, isEnoentError } from './errors.js';

export const thinkingLevels = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

export type ThinkingLevel = (typeof thinkingLevels)[number];

export type ProjectConfig = {
  /** 规范形式为 "provider/modelId"；也可只写 "modelId"（跨提供方重名时会得到明确报错）。 */
  model?: string;
  thinkingLevel?: ThinkingLevel;
};

export function loadProjectConfig(cwd: string): Promise<ProjectConfig | undefined> {
  return readProjectConfigFile(join(cwd, 'inkagent.json'));
}

export async function readProjectConfigFile(path: string): Promise<ProjectConfig | undefined> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    if (isEnoentError(error)) {
      return undefined;
    }
    throw new InkAgentError(`读取项目配置失败: ${path}`, { cause: error });
  }

  return parseProjectConfig(raw, path);
}

export function parseProjectConfig(raw: string, path: string): ProjectConfig {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new InkAgentError(`项目配置不是合法 JSON: ${path}`, { cause: error });
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InkAgentError(`项目配置必须是对象: ${path}`);
  }

  const config: ProjectConfig = {};
  const entries = Object.entries(value);
  for (const [key, fieldValue] of entries) {
    switch (key) {
      case 'model':
        config.model = expectNonEmptyString(key, fieldValue, path);
        break;
      case 'thinkingLevel':
        config.thinkingLevel = expectThinkingLevel(key, fieldValue, path);
        break;
      default:
        throw new InkAgentError(`项目配置包含未知字段 "${key}": ${path}`);
    }
  }
  return config;
}

function expectNonEmptyString(key: string, fieldValue: unknown, path: string): string {
  if (typeof fieldValue !== 'string' || fieldValue.trim().length === 0) {
    throw new InkAgentError(`项目配置字段 "${key}" 必须是非空字符串: ${path}`);
  }
  return fieldValue.trim();
}

function expectThinkingLevel(key: string, fieldValue: unknown, path: string): ThinkingLevel {
  const level = expectNonEmptyString(key, fieldValue, path);
  if (!thinkingLevels.some((candidate) => candidate === level)) {
    const expected = thinkingLevels.join(' / ');
    throw new InkAgentError(`项目配置字段 "${key}" 只支持: ${expected}: ${path}`);
  }
  return level as ThinkingLevel;
}
