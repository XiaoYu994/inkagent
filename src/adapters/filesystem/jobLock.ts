import { join } from 'node:path';

import type { DocumentJob, JobLock } from '../../application/ports.js';
import { acquireFileSystemLock } from './processLock.js';

const retryLockFileName = '.retry.inkagent.lock';

export async function acquireJobLock(job: DocumentJob): Promise<JobLock> {
  return acquireFileSystemLock({
    lockFile: join(job.workspace.rootDirectory, retryLockFileName),
    resourceLabel: `任务 ${job.id}`,
  });
}
