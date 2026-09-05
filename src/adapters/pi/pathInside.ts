import { homedir } from 'node:os';
import { resolve } from 'node:path';

import { isPathInside } from '../../shared/pathRelationship.js';

export function resolveSandboxPath(filePath: string, currentDirectory: string): string {
  const trimmedPath = filePath.trim();
  const pathWithoutPrefix = trimmedPath.startsWith('@') ? trimmedPath.slice(1) : trimmedPath;
  if (pathWithoutPrefix === '~' || pathWithoutPrefix.startsWith('~/')) {
    return resolve(homedir(), pathWithoutPrefix.slice(2));
  }
  return resolve(currentDirectory, pathWithoutPrefix);
}

export function assertSandboxPath(request: SandboxPathRequest): string {
  const absolutePath = resolveSandboxPath(request.filePath, request.currentDirectory);
  if (!isPathInside(absolutePath, request.allowedDirectory)) {
    throw new Error(`路径不在允许范围内: ${request.filePath}`);
  }
  return absolutePath;
}

export type SandboxPathRequest = {
  filePath: string;
  currentDirectory: string;
  allowedDirectory: string;
};
