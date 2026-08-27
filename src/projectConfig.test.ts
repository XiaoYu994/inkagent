import { describe, expect, it } from 'vitest';

import { InkAgentError } from './errors.js';
import { parseProjectConfig } from './projectConfig.js';

describe('parseProjectConfig', () => {
  it('reads model and thinking level', () => {
    const config = parseProjectConfig(
      JSON.stringify({ model: 'zai-coding-cn/glm-5.3-flash', thinkingLevel: 'xhigh' }),
      'inkagent.json',
    );

    expect(config).toEqual({
      model: 'zai-coding-cn/glm-5.3-flash',
      thinkingLevel: 'xhigh',
    });
  });

  it('allows an empty object as the minimal config', () => {
    expect(parseProjectConfig('{}', 'inkagent.json')).toEqual({});
  });

  it('rejects invalid json with the file path', () => {
    expect(() => parseProjectConfig('{ oops', 'inkagent.json')).toThrow(InkAgentError);
    expect(() => parseProjectConfig('{ oops', 'inkagent.json')).toThrow(/inkagent\.json/);
  });

  it('rejects unknown fields and wrong value types', () => {
    expect(() => parseProjectConfig('{"temperature":0.7}', 'c.json')).toThrow(/未知字段/);
    expect(() => parseProjectConfig('{"model":123}', 'c.json')).toThrow(/非空字符串/);
    expect(() => parseProjectConfig('{"thinkingLevel":"turbo"}', 'c.json')).toThrow(
      /thinkingLevel/,
    );
    expect(() => parseProjectConfig('[]', 'c.json')).toThrow(/必须是对象/);
  });
});
