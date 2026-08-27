import { parseArgs } from 'node:util';

import { InkAgentError } from './errors.js';
import type { GenerateDocumentOptions } from './generate.js';

export function parseGenerateArgs(argv: string[]): GenerateDocumentOptions {
  const [command, ...rest] = argv;
  if (command !== 'generate') {
    throw new InkAgentError('用法: inkagent generate --in <dir> --out <dir> [brief]');
  }

  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      in: { type: 'string' },
      out: { type: 'string' },
      'work-dir': { type: 'string' },
    },
  });

  const inputDir = values.in;
  const outputDir = values.out;
  if (!inputDir || !outputDir) {
    throw new InkAgentError('必须提供 --in 与 --out');
  }

  const brief = positionals.join(' ').trim();
  if (brief.length === 0) {
    throw new InkAgentError('必须提供 brief 文本');
  }

  const workDir = values['work-dir'];
  return {
    inputDir,
    outputDir,
    brief,
    ...(workDir === undefined ? {} : { workDir }),
  };
}
