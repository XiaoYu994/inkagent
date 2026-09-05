#!/usr/bin/env node

import { generateDocument, listDocumentJobs, readDocumentJob, retryDocument } from './generate.js';
import { parseCliArgs } from './cliArgs.js';
import { listProjectModelIds } from './adapters/pi/configuredDocumentAgent.js';
import { formatError } from './errors.js';

async function main(): Promise<void> {
  const parsed = parseCliArgs(process.argv.slice(2));
  if (parsed.kind === 'help') {
    process.stdout.write(parsed.text);
    return;
  }
  if (parsed.kind === 'models') {
    const ids = await listProjectModelIds(process.cwd());
    process.stdout.write(`${ids.join('\n')}\n`);
    return;
  }
  if (parsed.kind === 'jobs') {
    const jobs = await listDocumentJobs({
      ...(parsed.jobStorageDirectory === undefined
        ? {}
        : { jobStorageDirectory: parsed.jobStorageDirectory }),
    });
    process.stdout.write(`${JSON.stringify(jobs, null, 2)}\n`);
    return;
  }
  if (parsed.kind === 'status') {
    const job = await readDocumentJob(parsed.jobId, {
      ...(parsed.jobStorageDirectory === undefined
        ? {}
        : { jobStorageDirectory: parsed.jobStorageDirectory }),
    });
    process.stdout.write(`${JSON.stringify(job, null, 2)}\n`);
    return;
  }
  if (parsed.kind === 'retry') {
    const result = await retryDocument(parsed);
    process.stdout.write(`${result.outputDirectory}\n`);
    return;
  }

  const result = await generateDocument(parsed.options);
  process.stdout.write(`${result.outputDirectory}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${formatError(error, { verbose: Boolean(process.env.DEBUG) })}\n`);
  process.exitCode = 1;
});
