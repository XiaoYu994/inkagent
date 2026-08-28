import { cp, lstat, mkdir, readdir, realpath, rm, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { InkAgentError, isEnoentError } from '../../errors.js';

type TreeFile = {
  sourcePath: string;
  realPath: string;
  relativePath: string;
};

export type CopyTreeRequest = {
  sourceDirectory: string;
  targetDirectory: string;
};

export async function copyInputTree(request: CopyTreeRequest): Promise<string[]> {
  const files = await listTreeFiles(request.sourceDirectory);
  const copiedFiles: string[] = [];
  for (const file of files) {
    if (hasHiddenPathSegment(file.relativePath)) {
      continue;
    }
    await copyTreeFile(file, request.targetDirectory);
    copiedFiles.push(file.relativePath);
  }
  return copiedFiles.sort();
}

export async function copyMarkdownTree(request: CopyTreeRequest): Promise<string[]> {
  const files = (await listTreeFiles(request.sourceDirectory)).filter(
    (file) => !hasHiddenPathSegment(file.relativePath) && isMarkdownPath(file.relativePath),
  );
  if (files.length === 0) {
    throw new InkAgentError(`agent 没有在 ${request.sourceDirectory} 写出任何 Markdown`);
  }
  for (const file of files) {
    await copyTreeFile(file, request.targetDirectory);
  }
  return files.map((file) => file.relativePath).sort();
}

export async function assertOutputDirectoryUsable(outputDirectory: string): Promise<void> {
  let outputStats;
  try {
    outputStats = await lstat(outputDirectory);
  } catch (error) {
    if (isEnoentError(error)) {
      return;
    }
    throw new InkAgentError(`无法使用输出目录: ${outputDirectory}`, { cause: error });
  }
  if (!outputStats.isDirectory()) {
    throw new InkAgentError(`输出路径不是目录: ${outputDirectory}`);
  }
}

async function listTreeFiles(sourceDirectory: string): Promise<TreeFile[]> {
  const sourceRoot = await resolveRealPath(sourceDirectory, `无法读取目录 ${sourceDirectory}`);
  const entries = await readTreeEntries(sourceRoot);
  const files: TreeFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile() && !entry.isSymbolicLink()) {
      continue;
    }
    const parentDirectory =
      'parentPath' in entry && typeof entry.parentPath === 'string' ? entry.parentPath : sourceRoot;
    const sourcePath = resolve(parentDirectory, entry.name);
    const realPath = await resolveRealPath(sourcePath, `无法读取输入项 ${sourcePath}`);
    await assertRegularFile(sourcePath, realPath);
    files.push({
      sourcePath,
      realPath,
      relativePath: relative(sourceRoot, sourcePath).split(sep).join('/'),
    });
  }
  return files;
}

async function readTreeEntries(sourceDirectory: string) {
  try {
    return await readdir(sourceDirectory, { recursive: true, withFileTypes: true });
  } catch (error) {
    throw new InkAgentError(`读取目录失败: ${sourceDirectory}`, { cause: error });
  }
}

async function copyTreeFile(file: TreeFile, targetDirectory: string): Promise<void> {
  const targetPath = join(targetDirectory, file.relativePath);
  try {
    await mkdir(dirname(targetPath), { recursive: true });
    await cp(file.realPath, targetPath, { dereference: true });
  } catch (error) {
    throw new InkAgentError(`复制失败: ${file.relativePath}`, { cause: error });
  }
}

async function assertRegularFile(sourcePath: string, realPath: string): Promise<void> {
  let fileStats;
  try {
    fileStats = await stat(realPath);
  } catch (error) {
    throw new InkAgentError(`无法读取输入项 ${sourcePath}`, { cause: error });
  }
  if (!fileStats.isFile()) {
    throw new InkAgentError(`不支持复制非文件路径: ${sourcePath}`);
  }
}

async function resolveRealPath(path: string, message: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    throw new InkAgentError(message, { cause: error });
  }
}

function hasHiddenPathSegment(relativePath: string): boolean {
  return relativePath.split('/').some((segment) => segment.startsWith('.'));
}

function isMarkdownPath(relativePath: string): boolean {
  return relativePath.toLowerCase().endsWith('.md');
}

export async function removeDirectory(directory: string): Promise<void> {
  await rm(directory, { recursive: true, force: true });
}
