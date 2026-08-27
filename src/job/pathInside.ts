import { homedir } from 'node:os';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export function isPathInside(candidate: string, root: string): boolean {
  const resolvedCandidate = resolve(candidate);
  const resolvedRoot = resolve(root);
  const relativePath = relative(resolvedRoot, resolvedCandidate);
  return (
    relativePath === '' ||
    (relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath))
  );
}

export function resolveToolPath(filePath: string, cwd: string): string {
  const trimmed = filePath.trim();
  const withoutAt = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  if (withoutAt === '~' || withoutAt.startsWith('~/')) {
    return resolve(homedir(), withoutAt.slice(2));
  }
  return resolve(cwd, withoutAt);
}

export function assertPathInside(filePath: string, cwd: string, root: string): string {
  const absolutePath = resolveToolPath(filePath, cwd);
  if (!isPathInside(absolutePath, root)) {
    throw new Error(`路径不在允许范围内: ${filePath}`);
  }
  return absolutePath;
}
