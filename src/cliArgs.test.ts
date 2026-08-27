import { describe, expect, it } from 'vitest';

import { parseGenerateArgs } from './cliArgs.js';
import { InkAgentError } from './errors.js';

describe('parseGenerateArgs', () => {
  it('reads in out work-dir and brief', () => {
    const parsed = parseGenerateArgs([
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
      kind: 'options',
      options: {
        inputDir: './uploads',
        outputDir: './output',
        workDir: './tmp',
        brief: '写一份技术方案',
      },
    });
  });

  it('returns the help text for -h', () => {
    const parsed = parseGenerateArgs(['-h']);

    expect(parsed.kind).toBe('help');
    expect(parsed.kind === 'help' && parsed.text).toContain('--work-dir');
  });

  it('reads model and thinking-level flags', () => {
    const parsed = parseGenerateArgs([
      'generate',
      '--in',
      './uploads',
      '--out',
      './output',
      '--model',
      'zai-coding-cn/glm-5.3-flash',
      '--thinking-level',
      'xhigh',
      '写文档',
    ]);

    expect(parsed).toMatchObject({
      kind: 'options',
      options: {
        model: 'zai-coding-cn/glm-5.3-flash',
        thinkingLevel: 'xhigh',
      },
    });
  });

  it('rejects an unknown thinking level', () => {
    expect(() =>
      parseGenerateArgs([
        'generate',
        '--in',
        'a',
        '--out',
        'b',
        '--thinking-level',
        'turbo',
        '写文档',
      ]),
    ).toThrow(InkAgentError);
  });

  it('wraps unknown flags into InkAgentError with usage', () => {
    expect(() => parseGenerateArgs(['generate', '--nope'])).toThrow(InkAgentError);
    try {
      parseGenerateArgs(['generate', '--nope']);
    } catch (error) {
      expect((error as Error).message).toContain('用法');
    }
  });

  it('rejects missing generate command', () => {
    expect(() => parseGenerateArgs(['--in', 'a'])).toThrow(InkAgentError);
  });

  it('rejects missing brief text', () => {
    expect(() => parseGenerateArgs(['generate', '--in', 'a', '--out', 'b'])).toThrow(/brief/);
  });
});
