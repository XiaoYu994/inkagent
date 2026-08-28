import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { fileSystemDirectoryValidator } from './directoryValidator.js';

describe('fileSystemDirectoryValidator', () => {
  it('rejects overlapping input, job, and output directories', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-paths-'));
    const inputDirectory = join(rootDirectory, 'input');
    const jobStorageDirectory = join(rootDirectory, 'jobs');
    await mkdir(inputDirectory);
    await mkdir(jobStorageDirectory);

    await expect(
      fileSystemDirectoryValidator.validate({
        inputDirectory,
        jobStorageDirectory,
        outputDirectory: join(inputDirectory, 'output'),
      }),
    ).rejects.toThrow('输入目录与输出目录不能相同或互相包含');
  });

  it('allows independent directories when the output directory does not exist', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'inkagent-paths-'));
    await mkdir(join(rootDirectory, 'input'));

    await expect(
      fileSystemDirectoryValidator.validate({
        inputDirectory: join(rootDirectory, 'input'),
        jobStorageDirectory: join(rootDirectory, 'jobs'),
        outputDirectory: join(rootDirectory, 'output'),
      }),
    ).resolves.toBeUndefined();
  });
});
