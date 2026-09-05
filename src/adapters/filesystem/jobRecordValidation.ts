import { join, resolve } from 'node:path';

import type { DocumentJob, DocumentWorkspace } from '../../application/ports.js';
import { jobPhases, type JobFailure, type JobPhase } from '../../domain/job.js';
import { sourceKinds, type SourceKind } from '../../domain/material.js';
import { InkAgentError } from '../../errors.js';
import { isPathInside } from '../../shared/pathRelationship.js';

export function assertSafeJobId(jobId: string): void {
  if (jobId.length === 0 || jobId === '.' || jobId === '..' || /[\\/]/.test(jobId)) {
    throw new InkAgentError(`任务 ID 无效: ${jobId}`);
  }
}

export function validateStoredJob(
  job: Partial<DocumentJob>,
  jobId: string,
  jobStorageDirectory: string,
): DocumentJob {
  if (
    typeof job.id !== 'string' ||
    job.id !== jobId ||
    !isIndependentOutputDirectory(job.outputDirectory, jobStorageDirectory, jobId) ||
    !Array.isArray(job.extractions) ||
    !isValidJobState(job.phase, job.failure, jobId)
  ) {
    throw new InkAgentError(`任务记录格式无效: ${jobId}`);
  }
  const workspace = job.workspace;
  if (!isExpectedWorkspace(workspace, jobStorageDirectory, jobId)) {
    throw new InkAgentError(`任务记录格式无效: ${jobId}`);
  }
  assertValidExtractions(job.extractions, jobId, workspace);
  return job as DocumentJob;
}

function assertValidExtractions(
  extractions: readonly unknown[],
  jobId: string,
  workspace: DocumentWorkspace,
): void {
  extractions.forEach((extraction, index) => {
    if (!isRecord(extraction) || !isSourceKind(extraction.kind)) {
      throw new InkAgentError(`任务抽取记录无效: ${jobId} [${index}]`);
    }
    if (!isWorkspaceRelativePath(extraction.sourcePath, workspace.inputDirectory)) {
      throw new InkAgentError(`任务抽取记录无效: ${jobId} [${index}]`);
    }
    if (extraction.status === 'ok') {
      if (!isWorkspaceRelativePath(extraction.extractedPath, workspace.extractionDirectory)) {
        throw new InkAgentError(`任务抽取记录无效: ${jobId} [${index}]`);
      }
      return;
    }
    if (
      (extraction.status !== 'unsupported' && extraction.status !== 'error') ||
      typeof extraction.errorMessage !== 'string' ||
      extraction.errorMessage.length === 0
    ) {
      throw new InkAgentError(`任务抽取记录无效: ${jobId} [${index}]`);
    }
  });
}

function isWorkspaceRelativePath(path: unknown, workspaceDirectory: string): path is string {
  return (
    typeof path === 'string' &&
    path.length > 0 &&
    isPathInside(resolve(workspaceDirectory, path), workspaceDirectory)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSourceKind(value: unknown): value is SourceKind {
  return typeof value === 'string' && sourceKinds.includes(value as SourceKind);
}

function isValidJobState(phase: unknown, failure: unknown, jobId: string): phase is JobPhase {
  if (!isJobPhase(phase)) {
    throw new InkAgentError(`任务状态无效: ${jobId}`);
  }
  if (phase === 'failed') {
    if (!isJobFailure(failure)) {
      throw new InkAgentError(`任务失败记录无效: ${jobId}`);
    }
    return true;
  }
  if (failure !== undefined) {
    throw new InkAgentError(`任务失败记录无效: ${jobId}`);
  }
  return true;
}

function isJobPhase(value: unknown): value is JobPhase {
  return typeof value === 'string' && jobPhases.includes(value as JobPhase);
}

function isJobFailure(value: unknown): value is JobFailure {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const failure = value as Partial<JobFailure>;
  return isJobPhase(failure.phase) && typeof failure.message === 'string';
}

function isIndependentOutputDirectory(
  outputDirectory: unknown,
  jobStorageDirectory: string,
  jobId: string,
): outputDirectory is string {
  if (typeof outputDirectory !== 'string') {
    return false;
  }
  if (
    isPathInside(outputDirectory, jobStorageDirectory) ||
    isPathInside(jobStorageDirectory, outputDirectory)
  ) {
    throw new InkAgentError(`任务输出目录无效: ${jobId}`);
  }
  return true;
}

function isExpectedWorkspace(
  workspace: DocumentWorkspace | undefined,
  jobStorageDirectory: string,
  jobId: string,
): workspace is DocumentWorkspace {
  if (workspace === undefined) {
    return false;
  }
  const expectedWorkspace = createWorkspace(jobStorageDirectory, jobId);
  if (
    workspace.rootDirectory === expectedWorkspace.rootDirectory &&
    workspace.inputDirectory === expectedWorkspace.inputDirectory &&
    workspace.extractionDirectory === expectedWorkspace.extractionDirectory &&
    workspace.draftDirectory === expectedWorkspace.draftDirectory &&
    workspace.briefFile === expectedWorkspace.briefFile &&
    workspace.manifestFile === expectedWorkspace.manifestFile
  ) {
    return true;
  }
  throw new InkAgentError(`任务工作区无效: ${jobId}`);
}

function createWorkspace(parentDirectory: string, jobId: string): DocumentWorkspace {
  const rootDirectory = resolve(parentDirectory, jobId);
  return {
    rootDirectory,
    inputDirectory: join(rootDirectory, 'input'),
    extractionDirectory: join(rootDirectory, 'extract'),
    draftDirectory: join(rootDirectory, 'draft'),
    briefFile: join(rootDirectory, 'brief.md'),
    manifestFile: join(rootDirectory, 'manifest.json'),
  };
}
