import { basename, dirname, join } from 'node:path';

import { acquireFileSystemLock, type FileSystemLock } from './processLock.js';

export type OutputLock = FileSystemLock;

export async function acquireOutputLock(targetDirectory: string): Promise<OutputLock> {
  return acquireFileSystemLock({
    lockFile: join(dirname(targetDirectory), `.${basename(targetDirectory)}.inkagent.lock`),
    resourceLabel: '输出目录',
  });
}
