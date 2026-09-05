import { cp, lstat, mkdir, readFile, readdir, realpath, rm, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { InkAgentError, isEnoentError } from '../../errors.js';
import { defaultInputResourceLimits, type InputResourceLimits } from '../../application/ports.js';
import { assertValidInputResourceLimits } from '../../application/inputResourceLimits.js';
import { isPathInside } from '../../shared/pathRelationship.js';

type TreeFile = {
  sourcePath: string;
  realPath: string;
  relativePath: string;
  sizeBytes: number;
};

export type CopyTreeRequest = {
  sourceDirectory: string;
  targetDirectory: string;
  limits?: InputResourceLimits;
};

export async function copyInputTree(request: CopyTreeRequest): Promise<string[]> {
  const files = (await listTreeFiles(request.sourceDirectory)).filter(
    (file) => !hasHiddenPathSegment(file.relativePath),
  );
  assertInputResourceLimits(files, request.limits ?? defaultInputResourceLimits);
  const copiedFiles: string[] = [];
  for (const file of files) {
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

export async function copyNonMarkdownTree(request: CopyTreeRequest): Promise<string[]> {
  const files = (await listTreeFiles(request.sourceDirectory)).filter(
    (file) => !hasHiddenPathSegment(file.relativePath) && !isMarkdownPath(file.relativePath),
  );
  for (const file of files) {
    await copyTreeFile(file, request.targetDirectory);
  }
  return files.map((file) => file.relativePath).sort();
}

export async function validateMarkdownTree(sourceDirectory: string): Promise<void> {
  const files = (await listTreeFiles(sourceDirectory)).filter(
    (file) => !hasHiddenPathSegment(file.relativePath) && isMarkdownPath(file.relativePath),
  );
  if (files.length === 0) {
    throw new InkAgentError(`agent 没有在 ${sourceDirectory} 写出任何 Markdown`);
  }
  for (const file of files) {
    const content = await readFile(file.realPath, 'utf8');
    if (content.trim().length === 0) {
      throw new InkAgentError(`agent 写出的 Markdown 为空: ${file.relativePath}`);
    }
    await assertLocalMarkdownReferences(content, sourceDirectory, file.relativePath);
  }
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
    const sizeBytes = await assertRegularFile(sourcePath, realPath);
    files.push({
      sourcePath,
      realPath,
      relativePath: relative(sourceRoot, sourcePath).split(sep).join('/'),
      sizeBytes,
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

async function assertRegularFile(sourcePath: string, realPath: string): Promise<number> {
  let fileStats;
  try {
    fileStats = await stat(realPath);
  } catch (error) {
    throw new InkAgentError(`无法读取输入项 ${sourcePath}`, { cause: error });
  }
  if (!fileStats.isFile()) {
    throw new InkAgentError(`不支持复制非文件路径: ${sourcePath}`);
  }
  return fileStats.size;
}

function assertInputResourceLimits(files: readonly TreeFile[], limits: InputResourceLimits): void {
  assertValidInputResourceLimits(limits);
  if (files.length > limits.maxFiles) {
    throw new InkAgentError(`输入文件数量超过限制: ${files.length} > ${limits.maxFiles}`);
  }
  const oversizedFile = files.find((file) => file.sizeBytes > limits.maxFileBytes);
  if (oversizedFile !== undefined) {
    throw new InkAgentError(
      `输入文件超过单文件大小限制: ${oversizedFile.relativePath} (${oversizedFile.sizeBytes} > ${limits.maxFileBytes} bytes)`,
    );
  }
  const totalBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);
  if (totalBytes > limits.maxTotalBytes) {
    throw new InkAgentError(
      `输入文件总大小超过限制: ${totalBytes} > ${limits.maxTotalBytes} bytes`,
    );
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

async function assertLocalMarkdownReferences(
  content: string,
  sourceDirectory: string,
  relativeMarkdownPath: string,
): Promise<void> {
  const referencePattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of content.matchAll(referencePattern)) {
    const reference = match[1]?.trim().replace(/^<|>$/g, '');
    if (reference === undefined || isExternalReference(reference)) {
      continue;
    }
    const localPath = decodeLocalReferencePath(reference, relativeMarkdownPath);
    const targetPath = resolve(dirname(join(sourceDirectory, relativeMarkdownPath)), localPath);
    if (!isPathInside(targetPath, sourceDirectory)) {
      throw new InkAgentError(
        `Markdown 引用了发布目录之外的本地文件: ${relativeMarkdownPath} -> ${reference}`,
      );
    }
    try {
      const targetStats = await stat(targetPath);
      if (!targetStats.isFile()) {
        throw new Error('不是文件');
      }
    } catch (error) {
      throw new InkAgentError(
        `Markdown 引用了不存在的本地文件: ${relativeMarkdownPath} -> ${reference}`,
        { cause: error },
      );
    }
  }
}

function decodeLocalReferencePath(reference: string, relativeMarkdownPath: string): string {
  const referencePath = reference.split(/[?#]/, 1)[0] ?? '';
  try {
    return decodeURIComponent(referencePath);
  } catch (error) {
    throw new InkAgentError(`Markdown 本地引用格式无效: ${relativeMarkdownPath} -> ${reference}`, {
      cause: error,
    });
  }
}

function isExternalReference(reference: string): boolean {
  return reference.startsWith('#') || /^[a-z][a-z\d+.-]*:/i.test(reference);
}

export async function removeDirectory(directory: string): Promise<void> {
  await rm(directory, { recursive: true, force: true });
}
