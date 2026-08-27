import { parseArgs } from 'node:util';

import { InkAgentError, formatError } from './errors.js';
import { thinkingLevels, type ThinkingLevel } from './projectConfig.js';
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
  const model = values.model;
  const thinkingLevel = values['thinking-level'];
  if (thinkingLevel !== undefined && !thinkingLevels.some((level) => level === thinkingLevel)) {
    throw new InkAgentError(
      invalidWithUsage(`--thinking-level 只支持: ${thinkingLevels.join(' / ')}`),
    );
  }

  return {
    kind: 'options',
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
        in: { type: 'string' },
        out: { type: 'string' },
        'work-dir': { type: 'string' },
        model: { type: 'string' },
        'thinking-level': { type: 'string' },
      },
    }) as {
      values: {
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
    '  --model <引用>     指定模型（provider/modelId），默认取 inkagent.json 或 Pi 全局配置',
    '  --thinking-level <档> off/minimal/low/medium/high/xhigh/max',
    '  -h, --help        显示本帮助',
    '',
  ].join('\n');
}
