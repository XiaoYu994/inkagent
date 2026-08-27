import { describe, expect, it } from 'vitest';

import { parseGenerateArgs } from './cliArgs.js';
import { InkAgentError } from './errors.js';

describe('parseGenerateArgs', () => {
  it('reads in out work-dir and brief', () => {
    const options = parseGenerateArgs([
      'generate',
      '--in',
      './uploads',
      '--out',
      './output',
      '--work-dir',
      './tmp',
      '写一份技术方案',
    ]);

    expect(options.inputDir).toBe('./uploads');
    expect(options.outputDir).toBe('./output');
    expect(options.workDir).toBe('./tmp');
    expect(options.brief).toBe('写一份技术方案');
  });

  it('rejects missing generate command', () => {
    expect(() => parseGenerateArgs(['--in', 'a'])).toThrow(InkAgentError);
  });
});
