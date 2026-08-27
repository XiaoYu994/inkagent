#!/usr/bin/env node

import { generateDocument } from './generate.js';
import { parseCliArgs } from './cliArgs.js';
import { listAvailableModelIds } from './agent/piAgent.js';
import { formatError } from './errors.js';

async function main(): Promise<void> {
  const parsed = parseCliArgs(process.argv.slice(2));
  if (parsed.kind === 'help') {
    process.stdout.write(parsed.text);
    return;
  }
  if (parsed.kind === 'models') {
    const ids = await listAvailableModelIds();
    process.stdout.write(`${ids.join('\n')}\n`);
    return;
  }

  const result = await generateDocument(parsed.options);
  process.stdout.write(`${result.outputDir}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${formatError(error, { verbose: Boolean(process.env.DEBUG) })}\n`);
  process.exitCode = 1;
});
