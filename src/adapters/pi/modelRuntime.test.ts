import { describe, expect, it } from 'vitest';

import { createProjectModelRuntime } from './modelRuntime.js';

describe('createProjectModelRuntime', () => {
  it('registers project providers without loading the home model catalog', async () => {
    const runtime = await createProjectModelRuntime(
      {
        'zai-coding-cn': {
          models: [
            {
              id: 'glm-5.3-flash',
              name: 'GLM-5.3 Flash',
              reasoning: true,
              input: ['text', 'image'],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 1000,
              maxTokens: 100,
            },
          ],
        },
      },
      { refreshOnCreate: false },
    );

    expect(runtime.getModel('agnes', 'agnes-2.0-flash')).toBeUndefined();
    expect(runtime.getModel('zai-coding-cn', 'glm-5.3-flash')?.input).toEqual(['text', 'image']);
  });
});
