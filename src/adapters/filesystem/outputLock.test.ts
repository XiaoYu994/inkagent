import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { acquireOutputLock } from './outputLock.js';

describe('acquireOutputLock', () => {
  it('keeps the existing lock after a concurrent acquisition fails', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-lock-'));
    const outputDirectory = join(rootDirectory, 'output');
    const lock = await acquireOutputLock(outputDirectory);

    await expect(acquireOutputLock(outputDirectory)).rejects.toThrow('正在被另一个任务使用');
    await expect(acquireOutputLock(outputDirectory)).rejects.toThrow('正在被另一个任务使用');
    await lock.release();
  });

  it('allows reuse after release', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-lock-'));
    const outputDirectory = join(rootDirectory, 'output');
    const lock = await acquireOutputLock(outputDirectory);

    await lock.release();
    const nextLock = await acquireOutputLock(outputDirectory);
    await nextLock.release();
  });

  it('does not remove a subsequent lock when released again', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-lock-'));
    const outputDirectory = join(rootDirectory, 'output');
    const lock = await acquireOutputLock(outputDirectory);

    await lock.release();
    const nextLock = await acquireOutputLock(outputDirectory);
    await lock.release();

    await expect(acquireOutputLock(outputDirectory)).rejects.toThrow('正在被另一个任务使用');
    await nextLock.release();
  });

  it('recovers a lock left by a process that no longer exists', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-lock-'));
    const outputDirectory = join(rootDirectory, 'output');
    await writeFile(join(rootDirectory, '.output.inkagent.lock'), '999999999\n');

    const lock = await acquireOutputLock(outputDirectory);

    await lock.release();
  });
});
