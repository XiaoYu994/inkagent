#!/usr/bin/env node

import { generateDocument } from './generate.js';
import { parseGenerateArgs } from './cliArgs.js';
import { formatError } from './errors.js';

async function main(): Promise<void> {
  const parsed = parseGenerateArgs(process.argv.slice(2));
  if (parsed.kind === 'help') {
    process.stdout.write(parsed.text);
    return;
  }

  const result = await generateDocument(parsed.options);
  process.stdout.write(`${result.outputDir}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${formatError(error, { verbose: Boolean(process.env.DEBUG) })}\n`);
  process.exitCode = 1;
});
