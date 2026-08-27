import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { DocumentAgent } from './documentAgent.js';

export function createStubDocumentAgent(markdown = '# 生成稿\n\nstub\n'): DocumentAgent {
  return {
    async generate(jobDir: string): Promise<void> {
      await writeFile(join(jobDir, 'output', 'document.md'), markdown, 'utf8');
    },
  };
}
