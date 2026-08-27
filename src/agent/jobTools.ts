import { join } from 'node:path';

import {
  createEditToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createLsToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
  type ToolDefinition,
} from '@earendil-works/pi-coding-agent';

import { assertPathInside } from '../job/pathInside.js';

const jobToolNames = ['read', 'write', 'edit', 'grep', 'find', 'ls'] as const;

export function jobBoundToolNames(): string[] {
  return [...jobToolNames];
}

export function createJobBoundTools(jobDir: string): ToolDefinition[] {
  const outputDir = join(jobDir, 'output');
  return [
    confineTool(createReadToolDefinition(jobDir), jobDir, jobDir),
    confineTool(createWriteToolDefinition(jobDir), jobDir, outputDir),
    confineTool(createEditToolDefinition(jobDir), jobDir, outputDir),
    confineTool(createGrepToolDefinition(jobDir), jobDir, jobDir),
    confineTool(createFindToolDefinition(jobDir), jobDir, jobDir),
    confineTool(createLsToolDefinition(jobDir), jobDir, jobDir),
  ] as ToolDefinition[];
}

function confineTool<TDefinition extends { execute: (...args: never[]) => unknown }>(
  definition: TDefinition,
  cwd: string,
  root: string,
): TDefinition {
  const execute = definition.execute as (
    toolCallId: string,
    params: unknown,
    signal: AbortSignal | undefined,
    onUpdate: never,
    ctx: never,
  ) => ReturnType<TDefinition['execute']>;
  return {
    ...definition,
    execute: ((toolCallId, params, signal, onUpdate, ctx) => {
      assertPathInside(readPathParam(params), cwd, root);
      return execute(toolCallId, params, signal, onUpdate, ctx);
    }) as TDefinition['execute'],
  };
}

function readPathParam(params: unknown): string {
  if (typeof params !== 'object' || params === null || !('path' in params)) {
    return '.';
  }
  const path = params.path;
  return typeof path === 'string' && path.length > 0 ? path : '.';
}
