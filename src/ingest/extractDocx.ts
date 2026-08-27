import { createRequire } from 'node:module';

const mammoth = createRequire(import.meta.url)('mammoth') as {
  extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>;
};

export async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return result.value.trim();
}
