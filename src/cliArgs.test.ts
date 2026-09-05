import { describe, expect, it } from 'vitest';

import { parseCliArgs } from './cliArgs.js';
import { InkAgentError } from './errors.js';

describe('parseCliArgs', () => {
  it('reads input, output, job storage, and brief', () => {
    const parsed = parseCliArgs([
      'generate',
      '--input-directory',
      './uploads',
      '--output-directory',
      './output',
      '--job-directory',
      './tmp',
      '写一份技术方案',
    ]);

    expect(parsed).toMatchObject({
      kind: 'generate',
      options: {
        inputDirectory: './uploads',
        outputDirectory: './output',
        jobStorageDirectory: './tmp',
        brief: '写一份技术方案',
      },
    });
  });

  it('returns the help text for -h, --help, and generate --help', () => {
    expect(parseCliArgs(['-h']).kind).toBe('help');
    expect(parseCliArgs(['--help']).kind).toBe('help');
    const generateHelp = parseCliArgs(['generate', '--help']);
    expect(generateHelp.kind).toBe('help');
    expect(generateHelp.kind === 'help' && generateHelp.text).toContain('--job-directory');
    expect(generateHelp.kind === 'help' && generateHelp.text).toContain('<brief>');
  });

  it('reads model and thinking-level flags', () => {
    const parsed = parseCliArgs([
      'generate',
      '--input-directory',
      './uploads',
      '--output-directory',
      './output',
      '--model',
      'openrouter/vendor/model',
      '--thinking-level',
      'xhigh',
      '写文档',
    ]);

    expect(parsed).toMatchObject({
      kind: 'generate',
      options: {
        model: 'openrouter/vendor/model',
        thinkingLevel: 'xhigh',
      },
    });
  });

  it('parses the models command', () => {
    expect(parseCliArgs(['models'])).toEqual({ kind: 'models' });
  });

  it('parses status and retry commands', () => {
    expect(parseCliArgs(['status', '--job-directory', './jobs', 'job-1'])).toEqual({
      kind: 'status',
      jobId: 'job-1',
      jobStorageDirectory: './jobs',
    });
    expect(
      parseCliArgs(['retry', '--model', 'provider/model', '--thinking-level', 'high', 'job-1']),
    ).toEqual({
      kind: 'retry',
      jobId: 'job-1',
      model: 'provider/model',
      thinkingLevel: 'high',
    });
  });

  it('parses the jobs command', () => {
    expect(parseCliArgs(['jobs', '--job-directory', './jobs'])).toEqual({
      kind: 'jobs',
      jobStorageDirectory: './jobs',
    });
  });

  it('rejects an unknown thinking level', () => {
    expect(() =>
      parseCliArgs([
        'generate',
        '--input-directory',
        'a',
        '--output-directory',
        'b',
        '--thinking-level',
        'turbo',
        '写文档',
      ]),
    ).toThrow(InkAgentError);
  });

  it('wraps unknown flags into InkAgentError with usage', () => {
    expect(() => parseCliArgs(['generate', '--nope'])).toThrow(InkAgentError);
    try {
      parseCliArgs(['generate', '--nope']);
    } catch (error) {
      expect((error as Error).message).toContain('用法');
    }
  });

  it('rejects missing generate command', () => {
    expect(() => parseCliArgs(['--input-directory', 'a'])).toThrow(InkAgentError);
  });

  it('rejects missing brief text', () => {
    expect(() =>
      parseCliArgs(['generate', '--input-directory', 'a', '--output-directory', 'b']),
    ).toThrow(/brief/);
  });
});
