import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { thinkingLevels, type ThinkingLevel } from '../domain/thinkingLevel.js';
import { InkAgentError, isEnoentError } from '../errors.js';

export type PiProjectConfig = {
  providers?: Record<string, unknown>;
};

export type ProjectConfig = {
  model?: string;
  thinkingLevel?: ThinkingLevel;
  pi?: PiProjectConfig;
};

export async function readProjectConfig(
  projectDirectory: string,
): Promise<ProjectConfig | undefined> {
  return readProjectConfigFile(join(projectDirectory, 'inkagent.json'));
}

export async function readProjectConfigFile(filePath: string): Promise<ProjectConfig | undefined> {
  let rawConfig: string;
  try {
    rawConfig = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isEnoentError(error)) {
      return undefined;
    }
    throw new InkAgentError(`读取项目配置失败: ${filePath}`, { cause: error });
  }
  return parseProjectConfig(rawConfig, filePath);
}

export function parseProjectConfig(rawConfig: string, filePath: string): ProjectConfig {
  const value = parseJsonObject(rawConfig, filePath);
  assertKnownFields({
    value,
    allowedFields: ['model', 'thinkingLevel', 'pi'],
    scope: '项目配置',
    filePath,
  });
  return {
    ...(value.model === undefined ? {} : { model: parseModelReference(value.model, filePath) }),
    ...(value.thinkingLevel === undefined
      ? {}
      : { thinkingLevel: parseThinkingLevel(value.thinkingLevel, filePath) }),
    ...(value.pi === undefined ? {} : { pi: parsePiConfig(value.pi, filePath) }),
  };
}

function parsePiConfig(value: unknown, filePath: string): PiProjectConfig {
  const piConfig = requireObject(value, `项目配置字段 "pi" 必须是对象: ${filePath}`);
  assertKnownFields({
    value: piConfig,
    allowedFields: ['providers'],
    scope: '项目配置字段 "pi"',
    filePath,
  });
  return {
    ...(piConfig.providers === undefined
      ? {}
      : { providers: parseProviders(piConfig.providers, filePath) }),
  };
}

function parseJsonObject(rawConfig: string, filePath: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(rawConfig);
  } catch (error) {
    throw new InkAgentError(`项目配置不是合法 JSON: ${filePath}`, { cause: error });
  }
  return requireObject(value, `项目配置必须是对象: ${filePath}`);
}

type KnownFieldsRequest = {
  value: Record<string, unknown>;
  allowedFields: readonly string[];
  scope: string;
  filePath: string;
};

function assertKnownFields(request: KnownFieldsRequest): void {
  for (const key of Object.keys(request.value)) {
    if (!request.allowedFields.includes(key)) {
      throw new InkAgentError(`${request.scope}包含未知字段 "${key}": ${request.filePath}`);
    }
  }
}

function parseModelReference(value: unknown, filePath: string): string {
  const reference = requireNonEmptyString(
    value,
    `项目配置字段 "model" 必须是非空字符串: ${filePath}`,
  );
  if (!isModelReference(reference)) {
    throw new InkAgentError(`项目配置字段 "model" 必须是 provider/modelId: ${filePath}`);
  }
  return reference;
}

export function isModelReference(value: unknown): value is string {
  if (typeof value !== 'string' || value !== value.trim()) {
    return false;
  }
  const separator = value.indexOf('/');
  return separator > 0 && separator < value.length - 1;
}

function parseThinkingLevel(value: unknown, filePath: string): ThinkingLevel {
  const level = requireNonEmptyString(
    value,
    `项目配置字段 "thinkingLevel" 必须是非空字符串: ${filePath}`,
  );
  if (!thinkingLevels.some((candidate) => candidate === level)) {
    throw new InkAgentError(
      `项目配置字段 "thinkingLevel" 只支持: ${thinkingLevels.join(' / ')}: ${filePath}`,
    );
  }
  return level as ThinkingLevel;
}

function parseProviders(value: unknown, filePath: string): Record<string, unknown> {
  return requireObject(value, `项目配置字段 "pi.providers" 必须是对象: ${filePath}`);
}

function requireObject(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InkAgentError(message);
  }
  return value as Record<string, unknown>;
}

function requireNonEmptyString(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InkAgentError(message);
  }
  return value.trim();
}
