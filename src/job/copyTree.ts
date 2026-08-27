import { mkdir, readdir, cp, realpath } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

import { InkAgentError } from '../errors.js';

export async function copyInputTree(sourceDir: string, destinationDir: string): Promise<string[]> {
  const sourceRoot = await realpath(resolve(sourceDir));
  const copied: string[] = [];

  const entries = await readdir(sourceRoot, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() && !entry.isSymbolicLink()) {
      continue;
    }

    const parentDir =
      'parentPath' in entry && typeof entry.parentPath === 'string' ? entry.parentPath : sourceRoot;
    const inTreePath = resolve(parentDir, entry.name);

    let absolutePath: string;
    try {
      absolutePath = await realpath(inTreePath);
    } catch (error) {
      throw new InkAgentError(`无法读取输入项 ${inTreePath}`, { cause: error });
    }

    const relativePath = relative(sourceRoot, inTreePath);
    if (relativePath.split(sep).some((segment) => isHiddenPath(segment))) {
      continue;
    }

    const destinationPath = join(destinationDir, relativePath);
    await mkdir(join(destinationPath, '..'), { recursive: true });
    await cp(absolutePath, destinationPath, { dereference: true, recursive: true });
    copied.push(relativePath.split(sep).join('/'));
  }

  return copied.sort();
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
