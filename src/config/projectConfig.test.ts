import { describe, expect, it } from 'vitest';

import { InkAgentError } from '../errors.js';
import { parseProjectConfig } from './projectConfig.js';

describe('parseProjectConfig', () => {
  it('reads the model, thinking level, and Pi providers', () => {
    const providers = {
      'zai-coding-cn': {
        models: [{ id: 'glm-5.3-flash', input: ['text', 'image'] }],
      },
    };
    expect(
      parseProjectConfig(
        JSON.stringify({
          model: 'zai-coding-cn/glm-5.3-flash',
          thinkingLevel: 'xhigh',
          pi: { providers },
        }),
        'inkagent.json',
      ),
    ).toEqual({
      model: 'zai-coding-cn/glm-5.3-flash',
      thinkingLevel: 'xhigh',
      pi: { providers },
    });
  });

  it('allows an empty object as the minimal config', () => {
    expect(parseProjectConfig('{}', 'inkagent.json')).toEqual({});
  });

  it('rejects invalid values with the file path', () => {
    expect(() => parseProjectConfig('{ oops', 'inkagent.json')).toThrow(InkAgentError);
    expect(() => parseProjectConfig('{ oops', 'inkagent.json')).toThrow(/inkagent\.json/);
    expect(() => parseProjectConfig('{"temperature":0.7}', 'c.json')).toThrow(/未知字段/);
    expect(() => parseProjectConfig('{"model":123}', 'c.json')).toThrow(/非空字符串/);
    expect(() => parseProjectConfig('{"pi":{"providers":[]}}', 'c.json')).toThrow(/必须是对象/);
  });
});
