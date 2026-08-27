import { toMarkdown } from '@firecrawl/anydoc';

import { InkAgentError, formatError } from '../errors.js';

export async function convertDocumentToMarkdown(filePath: string): Promise<string> {
  try {
    const markdown = (await toMarkdown(filePath)).trim();
    if (markdown.length === 0) {
      throw new InkAgentError(`anydoc 没有从 ${filePath} 抽出有效 Markdown`);
    }
    return markdown;
  } catch (error) {
    if (error instanceof InkAgentError) {
      throw error;
    }
    const code = convertErrorCode(error);
    const suffix = code === undefined ? '' : ` (${code})`;
    throw new InkAgentError(`anydoc 解析失败: ${filePath}${suffix}: ${formatError(error)}`, {
      cause: error,
    });
  }
}

function convertErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = error.code;
    if (typeof code === 'string') {
      return code;
    }
  }
  return undefined;
}
