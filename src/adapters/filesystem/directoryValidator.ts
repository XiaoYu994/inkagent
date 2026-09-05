import { lstat, realpath } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

import type {
  GenerationDirectories,
  GenerationDirectoryValidator,
} from '../../application/ports.js';
import { InkAgentError, isEnoentError } from '../../errors.js';
import { isPathInside } from '../../shared/pathRelationship.js';

export const fileSystemDirectoryValidator: GenerationDirectoryValidator = {
  validate: validateGenerationDirectories,
};

async function validateGenerationDirectories(directories: GenerationDirectories): Promise<void> {
  await Promise.all([
    assertInputDirectory(directories.inputDirectory),
    assertOptionalDirectory(directories.jobStorageDirectory, '任务'),
    assertOptionalDirectory(directories.outputDirectory, '输出'),
  ]);
  await assertDirectoriesIndependent(directories);
}

async function assertDirectoriesIndependent(directories: GenerationDirectories): Promise<void> {
  const [inputDirectory, jobStorageDirectory, outputDirectory] = await Promise.all([
    resolveCanonicalPath(directories.inputDirectory),
    resolveCanonicalPath(directories.jobStorageDirectory),
    resolveCanonicalPath(directories.outputDirectory),
  ]);
  const namedDirectories = [
    ['输入', inputDirectory],
    ['任务', jobStorageDirectory],
    ['输出', outputDirectory],
  ] as const;

  for (const [leftIndex, left] of namedDirectories.entries()) {
    for (const right of namedDirectories.slice(leftIndex + 1)) {
      assertDirectoryPairIndependent(left, right);
    }
  }
}

function assertDirectoryPairIndependent(
  left: readonly [string, string],
  right: readonly [string, string],
): void {
  if (isPathInside(left[1], right[1]) || isPathInside(right[1], left[1])) {
    throw new InkAgentError(`${left[0]}目录与${right[0]}目录不能相同或互相包含`);
  }
}

async function assertInputDirectory(inputDirectory: string): Promise<void> {
  let inputStats;
  try {
    inputStats = await lstat(inputDirectory);
  } catch (error) {
    throw new InkAgentError(`读取输入目录失败: ${inputDirectory}`, { cause: error });
  }
  if (!inputStats.isDirectory()) {
    throw new InkAgentError(`输入路径不是目录: ${inputDirectory}`);
  }
}

async function assertOptionalDirectory(directory: string, label: string): Promise<void> {
  let directoryStats;
  try {
    directoryStats = await lstat(directory);
  } catch (error) {
    if (isEnoentError(error)) {
      return;
    }
    throw new InkAgentError(`无法使用${label}目录: ${directory}`, { cause: error });
  }
  if (!directoryStats.isDirectory()) {
    throw new InkAgentError(`${label}路径不是目录: ${directory}`);
  }
}

async function resolveCanonicalPath(path: string): Promise<string> {
  const absolutePath = resolve(path);
  try {
    return await realpath(absolutePath);
  } catch (error) {
    if (!isEnoentError(error)) {
      throw new InkAgentError(`无法解析目录路径: ${path}`, { cause: error });
    }
    const parentDirectory = dirname(absolutePath);
    if (parentDirectory === absolutePath) {
      return absolutePath;
    }
    return join(await resolveCanonicalPath(parentDirectory), basename(absolutePath));
  }
}
