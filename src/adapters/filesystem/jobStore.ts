import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import type {
  CreateJobRequest,
  DocumentJob,
  DocumentWorkspace,
  FailJobRequest,
  JobStore,
  RecordExtractionsRequest,
  UpdateJobPhaseRequest,
} from '../../application/ports.js';
import { formatError, InkAgentError } from '../../errors.js';

export const fileSystemJobStore: JobStore = {
  createJob,
  getJob,
  listJobs,
  updateJobPhase,
  clearDraft,
  recordExtractions,
  failJob,
};

async function createJob(request: CreateJobRequest): Promise<DocumentJob> {
  const jobId = randomUUID();
  const workspace = createWorkspace(request.jobStorageDirectory, jobId);
  await createWorkspaceDirectories(workspace);
  await writeTextFile(workspace.briefFile, `${request.brief}\n`);

  const job = createJobRecord(jobId, workspace);
  const jobWithOutput = { ...job, outputDirectory: request.outputDirectory };
  await writeJobFile(jobWithOutput);
  return jobWithOutput;
}

async function getJob(jobId: string, jobStorageDirectory: string): Promise<DocumentJob> {
  assertSafeJobId(jobId);
  const jobFile = join(jobStorageDirectory, jobId, 'job.json');
  try {
    const job = JSON.parse(await readFile(jobFile, 'utf8')) as Partial<DocumentJob>;
    return validateStoredJob(job, jobId);
  } catch (error) {
    if (error instanceof InkAgentError) {
      throw error;
    }
    throw new InkAgentError(`读取任务失败: ${jobId}`, { cause: error });
  }
}

async function listJobs(jobStorageDirectory: string): Promise<readonly DocumentJob[]> {
  let entries;
  try {
    entries = await readdir(jobStorageDirectory, { withFileTypes: true });
  } catch (error) {
    if (isMissingPathError(error)) {
      return [];
    }
    throw new InkAgentError(`读取任务目录失败: ${jobStorageDirectory}`, { cause: error });
  }
  const jobs = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => readJobForListing(entry.name, jobStorageDirectory)),
  );
  return sortJobsByUpdatedTime(jobs.filter((job): job is DocumentJob => job !== undefined));
}

async function readJobForListing(
  jobId: string,
  jobStorageDirectory: string,
): Promise<DocumentJob | undefined> {
  try {
    return await getJob(jobId, jobStorageDirectory);
  } catch (error) {
    reportSkippedJob(jobId, error);
    return undefined;
  }
}

function reportSkippedJob(jobId: string, error: unknown): void {
  process.stderr.write(`跳过无效任务记录 ${jobId}: ${formatError(error)}\n`);
}

async function sortJobsByUpdatedTime(
  jobs: readonly DocumentJob[],
): Promise<readonly DocumentJob[]> {
  const jobsWithTimes = await Promise.all(
    jobs.map(async (job) => ({ job, updatedAt: await readJobUpdatedTime(job) })),
  );
  return jobsWithTimes
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map(({ job }) => job);
}

async function readJobUpdatedTime(job: DocumentJob): Promise<number> {
  try {
    return (await stat(join(job.workspace.rootDirectory, 'job.json'))).mtimeMs;
  } catch (error) {
    throw new InkAgentError(`读取任务更新时间失败: ${job.id}`, { cause: error });
  }
}

function assertSafeJobId(jobId: string): void {
  if (jobId.length === 0 || jobId === '.' || jobId === '..' || /[\\/]/.test(jobId)) {
    throw new InkAgentError(`任务 ID 无效: ${jobId}`);
  }
}

function validateStoredJob(job: Partial<DocumentJob>, jobId: string): DocumentJob {
  if (
    typeof job.id !== 'string' ||
    job.id !== jobId ||
    typeof job.outputDirectory !== 'string' ||
    job.workspace === undefined ||
    !Array.isArray(job.extractions) ||
    job.phase === undefined
  ) {
    throw new InkAgentError(`任务记录格式无效: ${jobId}`);
  }
  return job as DocumentJob;
}

async function updateJobPhase(request: UpdateJobPhaseRequest): Promise<DocumentJob> {
  const job = { ...request.job, phase: request.phase };
  await writeJobFile(job);
  return job;
}

async function clearDraft(job: DocumentJob): Promise<void> {
  try {
    await rm(job.workspace.draftDirectory, { recursive: true, force: true });
    await mkdir(job.workspace.draftDirectory, { recursive: true });
  } catch (error) {
    throw new InkAgentError(`清理任务草稿失败: ${job.id}`, { cause: error });
  }
}

async function recordExtractions(request: RecordExtractionsRequest): Promise<DocumentJob> {
  const job = { ...request.job, extractions: [...request.extractions] };
  await writeJsonFile(job.workspace.manifestFile, {
    jobId: job.id,
    extracts: job.extractions,
  });
  await writeJobFile(job);
  return job;
}

async function failJob(request: FailJobRequest): Promise<DocumentJob> {
  const job: DocumentJob = {
    ...request.job,
    phase: 'failed',
    failure: {
      phase: request.job.phase,
      message: formatError(request.error),
    },
  };
  await writeJobFile(job);
  return job;
}

function createJobRecord(
  jobId: string,
  workspace: DocumentWorkspace,
): Omit<DocumentJob, 'outputDirectory'> {
  return {
    id: jobId,
    phase: 'created',
    workspace,
    extractions: [],
  };
}

function createWorkspace(parentDirectory: string, jobId: string): DocumentWorkspace {
  const rootDirectory = join(parentDirectory, jobId);
  return {
    rootDirectory,
    inputDirectory: join(rootDirectory, 'input'),
    extractionDirectory: join(rootDirectory, 'extract'),
    draftDirectory: join(rootDirectory, 'draft'),
    briefFile: join(rootDirectory, 'brief.md'),
    manifestFile: join(rootDirectory, 'manifest.json'),
  };
}

async function createWorkspaceDirectories(workspace: DocumentWorkspace): Promise<void> {
  await Promise.all([
    mkdir(workspace.inputDirectory, { recursive: true }),
    mkdir(workspace.extractionDirectory, { recursive: true }),
    mkdir(workspace.draftDirectory, { recursive: true }),
  ]);
}

async function writeJobFile(job: DocumentJob): Promise<void> {
  await writeJsonFile(join(job.workspace.rootDirectory, 'job.json'), job);
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeTextFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeTextFile(filePath: string, content: string): Promise<void> {
  const temporaryFile = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryFile, content, 'utf8');
    await rename(temporaryFile, filePath);
  } catch (error) {
    await rm(temporaryFile, { force: true });
    throw new InkAgentError(`写入任务文件失败: ${filePath}`, { cause: error });
  }
}

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}
