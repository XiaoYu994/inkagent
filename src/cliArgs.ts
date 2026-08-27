import { parseArgs } from 'node:util';

import { InkAgentError, formatError } from './errors.js';
import { thinkingLevels, type ThinkingLevel } from './projectConfig.js';
import type { GenerateDocumentOptions } from './generate.js';

export type ParsedCliArgs =
  | { kind: 'help'; text: string }
  | { kind: 'models' }
  | { kind: 'generate'; options: GenerateDocumentOptions };

export function parseCliArgs(argv: string[]): ParsedCliArgs {
  const [command, ...rest] = argv;
  if (command === undefined || isHelpToken(command)) {
    return { kind: 'help', text: usageText() };
  }
  if (command === 'models') {
    return parseModelsCommand(rest);
  }
  if (command !== 'generate') {
    throw new InkAgentError(invalidWithUsage('第一个参数必须是 generate 或 models'));
  }
  return parseGenerateCommand(rest);
}

function parseModelsCommand(args: string[]): ParsedCliArgs {
  if (args.some(isHelpToken)) {
    return { kind: 'help', text: usageText() };
  }
  if (args.length > 0) {
    throw new InkAgentError(invalidWithUsage('models 不接受额外参数'));
  }
  return { kind: 'models' };
}

function parseGenerateCommand(args: string[]): ParsedCliArgs {
  const { values, positionals } = parseGenerateFlags(args);
  if (values.help) {
    return { kind: 'help', text: usageText() };
  }

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
  const model = values.model;
  const thinkingLevel = values['thinking-level'];
  if (thinkingLevel !== undefined && !thinkingLevels.some((level) => level === thinkingLevel)) {
    throw new InkAgentError(
      invalidWithUsage(`--thinking-level 只支持: ${thinkingLevels.join(' / ')}`),
    );
  }

  return {
    kind: 'generate',
    options: {
      inputDir,
      outputDir,
      brief,
      ...(workDir === undefined ? {} : { workDir }),
      ...(model === undefined ? {} : { model }),
      ...(thinkingLevel === undefined ? {} : { thinkingLevel: thinkingLevel as ThinkingLevel }),
    },
  };
}

function parseGenerateFlags(args: string[]): {
  values: {
    help?: boolean;
    in?: string;
    out?: string;
    'work-dir'?: string;
    model?: string;
    'thinking-level'?: string;
  };
  positionals: string[];
} {
  try {
    return parseArgs({
      args,
      allowPositionals: true,
      options: {
        help: { type: 'boolean', short: 'h' },
        in: { type: 'string' },
        out: { type: 'string' },
        'work-dir': { type: 'string' },
        model: { type: 'string' },
        'thinking-level': { type: 'string' },
      },
    }) as {
      values: {
        help?: boolean;
        in?: string;
        out?: string;
        'work-dir'?: string;
        model?: string;
        'thinking-level'?: string;
      };
      positionals: string[];
    };
  } catch (error) {
    throw new InkAgentError(invalidWithUsage(formatError(error)), { cause: error });
  }
}

function isHelpToken(token: string): boolean {
  return token === '-h' || token === '--help' || token === 'help';
}

function invalidWithUsage(reason: string): string {
  return `${reason}\n${usageText()}`;
}

function usageText(): string {
  return [
    '用法:',
    '  inkagent generate --in <目录> --out <目录> [--model <引用>] <brief>',
    '  inkagent models',
    '',
    '选项:',
    '  --in <目录>       输入材料目录（必填）',
    '  --out <目录>      终稿输出目录（必填）',
    '  --work-dir <目录> 任务过程文件目录，默认 ./.inkagent/jobs',
    '  --model <引用>     指定模型（provider/modelId）。未传时读 inkagent.json，不再使用 Pi 全局默认',
    '  --thinking-level <档> off/minimal/low/medium/high/xhigh/max',
    '  -h, --help        显示本帮助',
    '',
  ].join('\n');
}
