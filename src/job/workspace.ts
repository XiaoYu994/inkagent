import { mkdir, readdir, cp, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

import { InkAgentError } from '../errors.js';

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

export async function copyInputTree(sourceDir: string, destinationDir: string): Promise<string[]> {
  const sourceRoot = resolve(sourceDir);
  const copied: string[] = [];

  const entries = await readdir(sourceRoot, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || isHiddenPath(entry.name)) {
      continue;
    }

    const parentDir =
      'parentPath' in entry && typeof entry.parentPath === 'string' ? entry.parentPath : sourceRoot;
    const absolutePath = resolve(parentDir, entry.name);
    assertInsideRoot(sourceRoot, absolutePath);

    const relativePath = relative(sourceRoot, absolutePath);
    if (relativePath.split(sep).some((segment) => isHiddenPath(segment))) {
      continue;
    }

    const destinationPath = join(destinationDir, relativePath);
    await mkdir(join(destinationPath, '..'), { recursive: true });
    await cp(absolutePath, destinationPath);
    copied.push(relativePath.split(sep).join('/'));
  }

  return copied.sort();
}

export async function writeBrief(workspace: JobWorkspace, brief: string): Promise<void> {
  await writeFile(workspace.briefPath, `${brief.trim()}\n`, 'utf8');
}

export async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function copyOutputTree(sourceDir: string, destinationDir: string): Promise<string[]> {
  await mkdir(destinationDir, { recursive: true });
  const copied = await copyInputTree(sourceDir, destinationDir);
  if (copied.length === 0) {
    throw new InkAgentError(`agent 没有在 ${sourceDir} 写出任何 Markdown`);
  }
  return copied;
}

function isHiddenPath(name: string): boolean {
  return name.startsWith('.');
}

function assertInsideRoot(rootDir: string, candidatePath: string): void {
  const relativePath = relative(rootDir, candidatePath);
  if (relativePath.startsWith('..') || relativePath === '') {
    throw new InkAgentError(`拒绝读取工作区之外的路径: ${candidatePath}`);
  }
}
