import { isAbsolute, relative, resolve, sep } from 'node:path';

export function isPathInside(candidatePath: string, rootDirectory: string): boolean {
  const relativePath = relative(resolve(rootDirectory), resolve(candidatePath));
  return (
    relativePath === '' ||
    (relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath))
  );
}
