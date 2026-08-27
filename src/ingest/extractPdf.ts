import { extractText } from 'unpdf';

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const result = await extractText(bytes, { mergePages: true });
  return result.text.trim();
}
