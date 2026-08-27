import { describe, expect, it } from 'vitest';

import { parseCliArgs } from './cliArgs.js';
import { InkAgentError } from './errors.js';

describe('parseCliArgs', () => {
  it('reads in out work-dir and brief', () => {
    const parsed = parseCliArgs([
      'generate',
      '--in',
      './uploads',
      '--out',
      './output',
      '--work-dir',
      './tmp',
      '写一份技术方案',
    ]);

    expect(parsed).toMatchObject({
      kind: 'generate',
      options: {
        inputDir: './uploads',
        outputDir: './output',
        workDir: './tmp',
        brief: '写一份技术方案',
      },
    });
  });

  it('returns the help text for -h, --help, and generate --help', () => {
    expect(parseCliArgs(['-h']).kind).toBe('help');
    expect(parseCliArgs(['--help']).kind).toBe('help');
    const generateHelp = parseCliArgs(['generate', '--help']);
    expect(generateHelp.kind).toBe('help');
    expect(generateHelp.kind === 'help' && generateHelp.text).toContain('--work-dir');
    expect(generateHelp.kind === 'help' && generateHelp.text).toContain('<brief>');
  });

  it('reads model and thinking-level flags', () => {
    const parsed = parseCliArgs([
      'generate',
      '--in',
      './uploads',
      '--out',
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

  it('rejects an unknown thinking level', () => {
    expect(() =>
      parseCliArgs(['generate', '--in', 'a', '--out', 'b', '--thinking-level', 'turbo', '写文档']),
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
    expect(() => parseCliArgs(['--in', 'a'])).toThrow(InkAgentError);
  });

  it('rejects missing brief text', () => {
    expect(() => parseCliArgs(['generate', '--in', 'a', '--out', 'b'])).toThrow(/brief/);
  });
});
