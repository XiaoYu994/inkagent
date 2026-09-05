import { mkdir, open, readFile, rm, type FileHandle } from 'node:fs/promises';
import { dirname } from 'node:path';

import { InkAgentError } from '../../errors.js';

export type FileSystemLock = {
  release(): Promise<void>;
};

export type AcquireFileSystemLockRequest = {
  lockFile: string;
  resourceLabel: string;
};

export async function acquireFileSystemLock(
  request: AcquireFileSystemLockRequest,
): Promise<FileSystemLock> {
  await mkdir(dirname(request.lockFile), { recursive: true });

  let fileHandle: FileHandle | undefined;
  try {
    fileHandle = await open(request.lockFile, 'wx');
    await fileHandle.writeFile(`${process.pid}\n`, 'utf8');
  } catch (error) {
    if (fileHandle !== undefined) {
      await removeFailedLock(request.lockFile, fileHandle);
    }
    if (hasErrorCode(error, 'EEXIST')) {
      await recoverStaleLock(request);
      return acquireFileSystemLock(request);
    }
    throw new InkAgentError(`无法锁定${request.resourceLabel}: ${request.lockFile}`, {
      cause: error,
    });
  }

  if (fileHandle === undefined) {
    throw new InkAgentError(`锁句柄未创建: ${request.resourceLabel}`);
  }
  return createLock(fileHandle, request.lockFile);
}

function createLock(fileHandle: FileHandle, lockFile: string): FileSystemLock {
  let releasePromise: Promise<void> | undefined;
  return {
    release(): Promise<void> {
      releasePromise ??= releaseFileSystemLock(fileHandle, lockFile);
      return releasePromise;
    },
  };
}

async function recoverStaleLock(request: AcquireFileSystemLockRequest): Promise<void> {
  const ownerProcessId = await readLockProcessId(request);
  if (ownerProcessId !== undefined && isProcessRunning(ownerProcessId)) {
    throw new InkAgentError(
      `${request.resourceLabel}正在被另一个任务使用（PID ${ownerProcessId}）`,
    );
  }
  try {
    await rm(request.lockFile);
  } catch (error) {
    if (!hasErrorCode(error, 'ENOENT')) {
      throw new InkAgentError(`无法恢复遗留锁: ${request.lockFile}`, { cause: error });
    }
  }
}

async function readLockProcessId(
  request: AcquireFileSystemLockRequest,
): Promise<number | undefined> {
  try {
    const content = await readFile(request.lockFile, 'utf8');
    const processId = Number.parseInt(content.trim(), 10);
    return Number.isSafeInteger(processId) && processId > 0 ? processId : undefined;
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      return undefined;
    }
    throw new InkAgentError(`无法读取锁: ${request.lockFile}`, { cause: error });
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

async function releaseFileSystemLock(fileHandle: FileHandle, lockFile: string): Promise<void> {
  try {
    await fileHandle.close();
  } finally {
    await rm(lockFile, { force: true });
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
