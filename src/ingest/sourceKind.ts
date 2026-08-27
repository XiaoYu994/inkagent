export const sourceKinds = [
  'markdown',
  'plain-text',
  'html',
  'pdf',
  'docx',
  'pptx',
  'image',
  'unsupported',
] as const;

export type SourceKind = (typeof sourceKinds)[number];

const extensionToKind: Record<string, SourceKind> = {
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.txt': 'plain-text',
  '.html': 'html',
  '.htm': 'html',
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.pptx': 'pptx',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
  '.gif': 'image',
};

export function detectSourceKind(fileName: string): SourceKind {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) {
    return 'unsupported';
  }
  const extension = fileName.slice(dot).toLowerCase();
  return extensionToKind[extension] ?? 'unsupported';
}
