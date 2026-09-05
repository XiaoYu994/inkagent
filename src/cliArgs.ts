import { parseArgs } from 'node:util';

import { InkAgentError, formatError } from './errors.js';
import { thinkingLevels, type ThinkingLevel } from './domain/thinkingLevel.js';
import type { GenerateDocumentOptions } from './generate.js';

export type ParsedCliArgs =
  | { kind: 'help'; text: string }
  | { kind: 'models' }
  | { kind: 'jobs'; jobStorageDirectory?: string }
  | { kind: 'status'; jobId: string; jobStorageDirectory?: string }
  | {
      kind: 'retry';
      jobId: string;
      jobStorageDirectory?: string;
      model?: string;
      thinkingLevel?: ThinkingLevel;
    }
  | { kind: 'generate'; options: GenerateDocumentOptions };

export function parseCliArgs(argv: string[]): ParsedCliArgs {
  const [command, ...rest] = argv;
  if (command === undefined || isHelpToken(command)) {
    return { kind: 'help', text: usageText() };
  }
  if (command === 'models') {
    return parseModelsCommand(rest);
  }
  if (command === 'jobs') {
    return parseJobsCommand(rest);
  }
  if (command === 'status') {
    return parseJobCommand('status', rest);
  }
  if (command === 'retry') {
    return parseRetryCommand(rest);
  }
  if (command !== 'generate') {
    throw new InkAgentError(
      invalidWithUsage('第一个参数必须是 generate、models、jobs、status 或 retry'),
    );
  }
  return parseGenerateCommand(rest);
}

function parseJobsCommand(args: string[]): ParsedCliArgs {
  const { values, positionals } = parseJobFlags(args);
  if (values.help) {
    return { kind: 'help', text: usageText() };
  }
  if (positionals.length > 0) {
    throw new InkAgentError(invalidWithUsage('jobs 不接受额外参数'));
  }
  return {
    kind: 'jobs',
    ...(values['job-directory'] === undefined
      ? {}
      : { jobStorageDirectory: values['job-directory'] as string }),
  };
}

function parseJobCommand(command: 'status', args: string[]): ParsedCliArgs {
  const { values, positionals } = parseJobFlags(args);
  if (values.help) {
    return { kind: 'help', text: usageText() };
  }
  const [jobId] = positionals;
  if (jobId === undefined || positionals.length !== 1) {
    throw new InkAgentError(invalidWithUsage(`${command} 必须提供一个 job-id`));
  }
  return {
    kind: 'status',
    jobId,
    ...(values['job-directory'] === undefined
      ? {}
      : { jobStorageDirectory: values['job-directory'] as string }),
  };
}

function parseRetryCommand(args: string[]): ParsedCliArgs {
  const { values, positionals } = parseRetryFlags(args);
  if (values.help) {
    return { kind: 'help', text: usageText() };
  }
  const [jobId] = positionals;
  if (jobId === undefined || positionals.length !== 1) {
    throw new InkAgentError(invalidWithUsage('retry 必须提供一个 job-id'));
  }
  const thinkingLevel = values['thinking-level'];
  if (thinkingLevel !== undefined && !thinkingLevels.some((level) => level === thinkingLevel)) {
    throw new InkAgentError(
      invalidWithUsage(`--thinking-level 只支持: ${thinkingLevels.join(' / ')}`),
    );
  }
  return {
    kind: 'retry',
    jobId,
    ...(values['job-directory'] === undefined
      ? {}
      : { jobStorageDirectory: values['job-directory'] as string }),
    ...(values.model === undefined ? {} : { model: values.model as string }),
    ...(thinkingLevel === undefined ? {} : { thinkingLevel: thinkingLevel as ThinkingLevel }),
  };
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

  const inputDirectory = values['input-directory'];
  const outputDirectory = values['output-directory'];
  if (!inputDirectory || !outputDirectory) {
    throw new InkAgentError(invalidWithUsage('必须提供 --input-directory 与 --output-directory'));
  }

  const brief = positionals.join(' ').trim();
  if (brief.length === 0) {
    throw new InkAgentError(invalidWithUsage('必须提供 brief 文本'));
  }

  const jobStorageDirectory = values['job-directory'];
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
      inputDirectory,
      outputDirectory,
      brief,
      ...(jobStorageDirectory === undefined ? {} : { jobStorageDirectory }),
      ...(model === undefined ? {} : { model }),
      ...(thinkingLevel === undefined ? {} : { thinkingLevel: thinkingLevel as ThinkingLevel }),
      ...(values['max-input-files'] === undefined
        ? {}
        : { maxInputFiles: parsePositiveInteger(values['max-input-files'], '--max-input-files') }),
      ...(values['max-input-file-bytes'] === undefined
        ? {}
        : {
            maxInputFileBytes: parsePositiveInteger(
              values['max-input-file-bytes'],
              '--max-input-file-bytes',
            ),
          }),
      ...(values['max-input-total-bytes'] === undefined
        ? {}
        : {
            maxInputTotalBytes: parsePositiveInteger(
              values['max-input-total-bytes'],
              '--max-input-total-bytes',
            ),
          }),
    },
  };
}

function parseGenerateFlags(args: string[]): {
  values: {
    help?: boolean;
    'input-directory'?: string;
    'output-directory'?: string;
    'job-directory'?: string;
    model?: string;
    'thinking-level'?: string;
    'max-input-files'?: string;
    'max-input-file-bytes'?: string;
    'max-input-total-bytes'?: string;
  };
  positionals: string[];
} {
  try {
    return parseArgs({
      args,
      allowPositionals: true,
      options: {
        help: { type: 'boolean', short: 'h' },
        'input-directory': { type: 'string' },
        'output-directory': { type: 'string' },
        'job-directory': { type: 'string' },
        model: { type: 'string' },
        'thinking-level': { type: 'string' },
        'max-input-files': { type: 'string' },
        'max-input-file-bytes': { type: 'string' },
        'max-input-total-bytes': { type: 'string' },
      },
    }) as {
      values: {
        help?: boolean;
        'input-directory'?: string;
        'output-directory'?: string;
        'job-directory'?: string;
        model?: string;
        'thinking-level'?: string;
        'max-input-files'?: string;
        'max-input-file-bytes'?: string;
        'max-input-total-bytes'?: string;
      };
      positionals: string[];
    };
  } catch (error) {
    throw new InkAgentError(invalidWithUsage(formatError(error)), { cause: error });
  }
}

function parsePositiveInteger(value: string, flagName: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new InkAgentError(invalidWithUsage(`${flagName} 必须是正整数`));
  }
  return parsed;
}

function parseJobFlags(args: string[]) {
  return parseCommandFlags(args, { 'job-directory': { type: 'string' } });
}

function parseRetryFlags(args: string[]) {
  return parseCommandFlags(args, {
    'job-directory': { type: 'string' },
    model: { type: 'string' },
    'thinking-level': { type: 'string' },
  });
}

function parseCommandFlags(
  args: string[],
  commandOptions: Record<string, { type: 'string' }>,
): { values: Record<string, string | boolean | undefined>; positionals: string[] } {
  try {
    return parseArgs({
      args,
      allowPositionals: true,
      options: { help: { type: 'boolean', short: 'h' }, ...commandOptions },
    }) as { values: Record<string, string | boolean | undefined>; positionals: string[] };
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
    '  inkagent generate --input-directory <目录> --output-directory <目录> [选项] <brief>',
    '  inkagent models',
    '  inkagent jobs [--job-directory <目录>]',
    '  inkagent status [--job-directory <目录>] <job-id>',
    '  inkagent retry [--job-directory <目录>] [--model <引用>] <job-id>',
    '',
    '选项:',
    '  --input-directory <目录>  输入材料目录（必填）',
    '  --output-directory <目录> 终稿输出目录（必填）',
    '  --job-directory <目录>     任务过程文件目录，默认 ./.inkagent/jobs',
    '  --model <引用>     指定模型（provider/modelId）。未传时读 inkagent.json，不再使用 Pi 全局默认',
    '  --thinking-level <档> off/minimal/low/medium/high/xhigh/max',
    '  --max-input-files <数量>  输入文件数量上限，默认 1000',
    '  --max-input-file-bytes <字节>  单个输入文件大小上限，默认 52428800',
    '  --max-input-total-bytes <字节> 输入文件总大小上限，默认 209715200',
    '  -h, --help        显示本帮助',
    '',
  ].join('\n');
}
