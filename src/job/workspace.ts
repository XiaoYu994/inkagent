import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export type JobWorkspace = {
  jobId: string;
  rootDir: string;
  inputDir: string;
  extractDir: string;
  outputDir: string;
  briefPath: string;
  manifestPath: string;
};

export async function createJobWorkspace(parentDir: string): Promise<JobWorkspace> {
  const jobId = randomUUID();
  const rootDir = join(parentDir, jobId);
  const inputDir = join(rootDir, 'input');
  const extractDir = join(rootDir, 'extract');
  const outputDir = join(rootDir, 'output');

  await mkdir(inputDir, { recursive: true });
  await mkdir(extractDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  return {
    jobId,
    rootDir,
    inputDir,
    extractDir,
    outputDir,
    briefPath: join(rootDir, 'brief.md'),
    manifestPath: join(rootDir, 'manifest.json'),
  };
}

export async function writeBrief(workspace: JobWorkspace, brief: string): Promise<void> {
  await writeFile(workspace.briefPath, `${brief.trim()}\n`, 'utf8');
}

export async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
