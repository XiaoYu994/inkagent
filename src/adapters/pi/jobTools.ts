import {
  createEditToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createLsToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
  type ToolDefinition,
} from '@earendil-works/pi-coding-agent';

import { assertSandboxPath } from './pathInside.js';

const toolNames = ['read', 'write', 'edit', 'grep', 'find', 'ls'] as const;

export function getDocumentToolNames(): string[] {
  return [...toolNames];
}

export function createDocumentTools(
  workspaceDirectory: string,
  draftDirectory: string,
): ToolDefinition[] {
  return [
    confineTool({
      definition: createReadToolDefinition(workspaceDirectory),
      currentDirectory: workspaceDirectory,
      allowedDirectory: workspaceDirectory,
    }),
    confineTool({
      definition: createWriteToolDefinition(workspaceDirectory),
      currentDirectory: workspaceDirectory,
      allowedDirectory: draftDirectory,
    }),
    confineTool({
      definition: createEditToolDefinition(workspaceDirectory),
      currentDirectory: workspaceDirectory,
      allowedDirectory: draftDirectory,
    }),
    confineTool({
      definition: createGrepToolDefinition(workspaceDirectory),
      currentDirectory: workspaceDirectory,
      allowedDirectory: workspaceDirectory,
    }),
    confineTool({
      definition: createFindToolDefinition(workspaceDirectory),
      currentDirectory: workspaceDirectory,
      allowedDirectory: workspaceDirectory,
    }),
    confineTool({
      definition: createLsToolDefinition(workspaceDirectory),
      currentDirectory: workspaceDirectory,
      allowedDirectory: workspaceDirectory,
    }),
  ] as ToolDefinition[];
}

type ConfinedToolRequest<TDefinition> = {
  definition: TDefinition;
  currentDirectory: string;
  allowedDirectory: string;
};

function confineTool<TDefinition extends { execute: (...args: never[]) => unknown }>({
  definition,
  currentDirectory,
  allowedDirectory,
}: ConfinedToolRequest<TDefinition>): TDefinition {
  const execute = definition.execute as (
    toolCallId: string,
    parameters: unknown,
    signal: AbortSignal | undefined,
    onUpdate: never,
    context: never,
  ) => ReturnType<TDefinition['execute']>;
  return {
    ...definition,
    execute: ((toolCallId, parameters, signal, onUpdate, context) => {
      assertSandboxPath({
        filePath: readPath(parameters),
        currentDirectory,
        allowedDirectory,
      });
      return execute(toolCallId, parameters, signal, onUpdate, context);
    }) as TDefinition['execute'],
  };
}

function readPath(parameters: unknown): string {
  if (typeof parameters !== 'object' || parameters === null || !('path' in parameters)) {
    return '.';
  }
  const path = parameters.path;
  return typeof path === 'string' && path.length > 0 ? path : '.';
}
