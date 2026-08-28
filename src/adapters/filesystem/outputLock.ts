import { mkdir, open, rm, type FileHandle } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import { InkAgentError } from '../../errors.js';

export type OutputLock = {
  release(): Promise<void>;
};

export async function acquireOutputLock(targetDirectory: string): Promise<OutputLock> {
  const parentDirectory = dirname(targetDirectory);
  const lockFile = join(parentDirectory, `.${basename(targetDirectory)}.inkagent.lock`);
  await mkdir(parentDirectory, { recursive: true });

  let fileHandle: FileHandle | undefined;
  try {
    fileHandle = await open(lockFile, 'wx');
    await fileHandle.writeFile(`${process.pid}\n`, 'utf8');
  } catch (error) {
    if (fileHandle !== undefined) {
      await removeFailedLock(lockFile, fileHandle);
    }
    if (hasErrorCode(error, 'EEXIST')) {
      throw new InkAgentError(`输出目录正在被另一个任务使用: ${targetDirectory}`);
    }
    throw new InkAgentError(`无法锁定输出目录: ${targetDirectory}`, { cause: error });
  }

  if (fileHandle === undefined) {
    throw new InkAgentError(`输出锁句柄未创建: ${targetDirectory}`);
  }
  const acquiredFileHandle = fileHandle;
  let releasePromise: Promise<void> | undefined;

  return {
    release(): Promise<void> {
      releasePromise ??= releaseOutputLock(acquiredFileHandle, lockFile);
      return releasePromise;
    },
  };
}

async function removeFailedLock(lockFile: string, fileHandle: FileHandle): Promise<void> {
  await fileHandle.close();
  await rm(lockFile, { force: true });
}

async function releaseOutputLock(fileHandle: FileHandle, lockFile: string): Promise<void> {
  try {
    await fileHandle.close();
  } finally {
    await rm(lockFile, { force: true });
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
