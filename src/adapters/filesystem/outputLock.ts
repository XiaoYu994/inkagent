import { mkdir, open, readFile, rm, type FileHandle } from 'node:fs/promises';
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
      await recoverStaleLock(lockFile);
      return acquireOutputLock(targetDirectory);
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

async function recoverStaleLock(lockFile: string): Promise<void> {
  const ownerProcessId = await readLockProcessId(lockFile);
  if (ownerProcessId !== undefined && isProcessRunning(ownerProcessId)) {
    throw new InkAgentError(`输出目录正在被另一个任务使用（PID ${ownerProcessId}）`);
  }
  try {
    await rm(lockFile);
  } catch (error) {
    if (!hasErrorCode(error, 'ENOENT')) {
      throw new InkAgentError(`无法恢复遗留输出锁: ${lockFile}`, { cause: error });
    }
  }
}

async function readLockProcessId(lockFile: string): Promise<number | undefined> {
  try {
    const content = await readFile(lockFile, 'utf8');
    const processId = Number.parseInt(content.trim(), 10);
    return Number.isSafeInteger(processId) && processId > 0 ? processId : undefined;
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      return undefined;
    }
    throw new InkAgentError(`无法读取输出锁: ${lockFile}`, { cause: error });
  }
}

function isProcessRunning(processId: number): boolean {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return !hasErrorCode(error, 'ESRCH');
  }
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
