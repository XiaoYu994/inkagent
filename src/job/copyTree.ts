import { mkdir, readdir, cp, realpath, rm, lstat, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { InkAgentError, isEnoentError } from '../errors.js';

type TreeFile = {
  inTreePath: string;
  absolutePath: string;
  relativePosix: string;
};

export async function copyInputTree(sourceDir: string, destinationDir: string): Promise<string[]> {
  const files = await listTreeFiles(sourceDir);
  const copied: string[] = [];

  for (const file of files) {
    if (hasHiddenSegment(file.relativePosix)) {
      continue;
    }
    await copyTreeFile(file, destinationDir);
    copied.push(file.relativePosix);
  }

  return copied.sort();
}

export async function copyOutputTree(sourceDir: string, destinationDir: string): Promise<string[]> {
  const files = (await listTreeFiles(sourceDir)).filter(
    (file) => !hasHiddenSegment(file.relativePosix) && isMarkdownPath(file.relativePosix),
  );
  if (files.length === 0) {
    throw new InkAgentError(`agent 没有在 ${sourceDir} 写出任何 Markdown`);
  }

  await emptyDirectory(destinationDir);
  const copied: string[] = [];
  for (const file of files) {
    await copyTreeFile(file, destinationDir);
    copied.push(file.relativePosix);
  }
  return copied.sort();
}

export async function assertOutputDirUsable(outputDir: string): Promise<void> {
  let stats;
  try {
    stats = await lstat(outputDir);
  } catch (error) {
    if (isEnoentError(error)) {
      return;
    }
    throw new InkAgentError(`无法使用输出目录: ${outputDir}`, { cause: error });
  }
  if (!stats.isDirectory()) {
    throw new InkAgentError(`输出路径不是目录: ${outputDir}`);
  }
}

async function listTreeFiles(sourceDir: string): Promise<TreeFile[]> {
  const sourceRoot = await realpathSafe(resolve(sourceDir), `无法读取目录 ${sourceDir}`);
  const entries = await readDirSafe(sourceRoot);
  const files: TreeFile[] = [];

  for (const entry of entries) {
    if (!entry.isFile() && !entry.isSymbolicLink()) {
      continue;
    }

    const parentDir =
      'parentPath' in entry && typeof entry.parentPath === 'string' ? entry.parentPath : sourceRoot;
    const inTreePath = resolve(parentDir, entry.name);
    const absolutePath = await realpathSafe(inTreePath, `无法读取输入项 ${inTreePath}`);
    await assertCopiedFile(inTreePath, absolutePath);

    files.push({
      inTreePath,
      absolutePath,
      relativePosix: relative(sourceRoot, inTreePath).split(sep).join('/'),
    });
  }

  return files;
}

async function copyTreeFile(file: TreeFile, destinationDir: string): Promise<void> {
  const destinationPath = join(destinationDir, file.relativePosix);
  try {
    await mkdir(dirname(destinationPath), { recursive: true });
    await cp(file.absolutePath, destinationPath, { dereference: true });
  } catch (error) {
    throw new InkAgentError(`复制失败: ${file.relativePosix}`, { cause: error });
  }
}

async function emptyDirectory(directory: string): Promise<void> {
  try {
    const stats = await lstat(directory);
    if (!stats.isDirectory()) {
      throw new InkAgentError(`输出路径不是目录: ${directory}`);
    }
    await rm(directory, { recursive: true, force: true });
  } catch (error) {
    if (error instanceof InkAgentError) {
      throw error;
    }
    if (!isEnoentError(error)) {
      throw new InkAgentError(`无法使用输出目录: ${directory}`, { cause: error });
    }
  }

  try {
    await mkdir(directory, { recursive: true });
  } catch (error) {
    throw new InkAgentError(`无法创建输出目录: ${directory}`, { cause: error });
  }
}

async function assertCopiedFile(inTreePath: string, absolutePath: string): Promise<void> {
  let stats;
  try {
    stats = await stat(absolutePath);
  } catch (error) {
    throw new InkAgentError(`无法读取输入项 ${inTreePath}`, { cause: error });
  }
  if (!stats.isFile()) {
    throw new InkAgentError(`不支持复制非文件路径: ${inTreePath}`);
  }
}

async function realpathSafe(path: string, message: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    throw new InkAgentError(message, { cause: error });
  }
}

async function readDirSafe(sourceRoot: string) {
  try {
    return await readdir(sourceRoot, { recursive: true, withFileTypes: true });
  } catch (error) {
    throw new InkAgentError(`读取目录失败: ${sourceRoot}`, { cause: error });
  }
}

function hasHiddenSegment(relativePosix: string): boolean {
  return relativePosix.split('/').some((segment) => segment.startsWith('.'));
}

function isMarkdownPath(relativePosix: string): boolean {
  return relativePosix.toLowerCase().endsWith('.md');
}
