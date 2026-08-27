import { parseArgs } from 'node:util';

import { InkAgentError, formatError } from './errors.js';
import type { GenerateDocumentOptions } from './generate.js';

export type ParsedGenerateArgs =
  { kind: 'help'; text: string } | { kind: 'options'; options: GenerateDocumentOptions };

export function parseGenerateArgs(argv: string[]): ParsedGenerateArgs {
  const [command, ...rest] = argv;
  if (command === '-h' || command === '--help' || command === 'help') {
    return { kind: 'help', text: usageText() };
  }
  if (command !== 'generate') {
    throw new InkAgentError(invalidWithUsage('第一个参数必须是 generate'));
  }

  const { values, positionals } = parseGenerateFlags(rest);

  const inputDir = values.in;
  const outputDir = values.out;
  if (!inputDir || !outputDir) {
    throw new InkAgentError(invalidWithUsage('必须提供 --in 与 --out'));
  }

  const brief = positionals.join(' ').trim();
  if (brief.length === 0) {
    throw new InkAgentError(invalidWithUsage('必须提供 brief 文本'));
  }

  const workDir = values['work-dir'];
  return {
    kind: 'options',
    options: {
      inputDir,
      outputDir,
      brief,
      ...(workDir === undefined ? {} : { workDir }),
    },
  };
}

function parseGenerateFlags(args: string[]): {
  values: { in?: string; out?: string; 'work-dir'?: string };
  positionals: string[];
} {
  try {
    return parseArgs({
      args,
      allowPositionals: true,
      options: {
        in: { type: 'string' },
        out: { type: 'string' },
        'work-dir': { type: 'string' },
      },
    }) as { values: { in?: string; out?: string; 'work-dir'?: string }; positionals: string[] };
  } catch (error) {
    throw new InkAgentError(invalidWithUsage(formatError(error)), { cause: error });
  }
}

function invalidWithUsage(reason: string): string {
  return `${reason}\n${usageText()}`;
}

function usageText(): string {
  return [
    '用法: inkagent generate --in <目录> --out <目录> [brief]',
    '',
    '选项:',
    '  --in <目录>       输入材料目录（必填）',
    '  --out <目录>      终稿输出目录（必填）',
    '  --work-dir <目录> 任务过程文件目录，默认 ./.inkagent/jobs',
    '  -h, --help        显示本帮助',
    '',
  ].join('\n');
}
