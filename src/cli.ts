#!/usr/bin/env node

import { generateDocument } from './generate.js';
import { parseGenerateArgs } from './cliArgs.js';
import { formatError } from './errors.js';

async function main(): Promise<void> {
  const options = parseGenerateArgs(process.argv.slice(2));
  const result = await generateDocument(options);
  process.stdout.write(`${result.outputDir}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${formatError(error)}\n`);
  process.exitCode = 1;
});
