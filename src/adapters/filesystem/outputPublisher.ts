import { dirname, join } from 'node:path';
import { mkdir, mkdtemp, rename, rm, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

import type {
  OutputPublisher,
  PublishDraftRequest,
  PublishedDraft,
} from '../../application/ports.js';
import { InkAgentError } from '../../errors.js';
import { acquireOutputLock } from './outputLock.js';
import { assertOutputDirectoryUsable } from './treeFiles.js';
import { copyMarkdownTree } from './treeFiles.js';

export const fileSystemOutputPublisher: OutputPublisher = {
  publish: publishMarkdownDraft,
};

async function publishMarkdownDraft(request: PublishDraftRequest): Promise<PublishedDraft> {
  const outputLock = await acquireOutputLock(request.targetDirectory);
  try {
    return await publishLockedDraft(request);
  } finally {
    await outputLock.release();
  }
}

async function publishLockedDraft(request: PublishDraftRequest): Promise<PublishedDraft> {
  await assertOutputDirectoryUsable(request.targetDirectory);
  const temporaryDirectory = await createTemporaryOutputDirectory(request.targetDirectory);
  try {
    const files = await copyMarkdownTree({
      sourceDirectory: request.sourceDirectory,
      targetDirectory: temporaryDirectory,
    });
    await replaceOutputDirectory(temporaryDirectory, request.targetDirectory);
    return { files };
  } catch (error) {
    await removeTemporaryDirectory(temporaryDirectory);
    throw error;
  }
}

async function createTemporaryOutputDirectory(targetDirectory: string): Promise<string> {
  try {
    await mkdir(dirname(targetDirectory), { recursive: true });
    return await mkdtemp(join(dirname(targetDirectory), '.inkagent-output-'));
  } catch (error) {
    throw new InkAgentError(`无法创建输出临时目录: ${targetDirectory}`, { cause: error });
  }
}

async function replaceOutputDirectory(
  temporaryDirectory: string,
  targetDirectory: string,
): Promise<void> {
  const backupDirectory = `${targetDirectory}.previous-${randomUUID()}`;
  try {
    await renameExistingDirectory(targetDirectory, backupDirectory);
    await rename(temporaryDirectory, targetDirectory);
    await removeTemporaryDirectory(backupDirectory);
  } catch (error) {
    await restoreOutputDirectory(targetDirectory, backupDirectory);
    throw new InkAgentError(`发布输出失败: ${targetDirectory}`, { cause: error });
  }
}

async function renameExistingDirectory(
  targetDirectory: string,
  backupDirectory: string,
): Promise<boolean> {
  try {
    await rename(targetDirectory, backupDirectory);
    return true;
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }
    throw error;
  }
}

async function restoreOutputDirectory(
  targetDirectory: string,
  backupDirectory: string,
): Promise<void> {
  await removeTemporaryDirectory(targetDirectory);
  if (await directoryExists(backupDirectory)) {
    await rename(backupDirectory, targetDirectory);
  }
}

async function directoryExists(directory: string): Promise<boolean> {
  try {
    await stat(directory);
    return true;
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }
    throw error;
  }
}

async function removeTemporaryDirectory(directory: string): Promise<void> {
  await rm(directory, { recursive: true, force: true });
}

function isMissingPathError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
