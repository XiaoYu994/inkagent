export const sourceKinds = [
  'markdown',
  'plain-text',
  'html',
  'image',
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xlsx',
  'csv',
  'odt',
  'ods',
  'odp',
  'rtf',
  'epub',
  'unsupported',
] as const;

export type SourceKind = (typeof sourceKinds)[number];

const extensionToKind: Record<string, SourceKind> = {
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.txt': 'plain-text',
  '.html': 'html',
  '.htm': 'html',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
  '.gif': 'image',
  '.pdf': 'pdf',
  '.doc': 'doc',
  '.docx': 'docx',
  '.docm': 'docx',
  '.ppt': 'ppt',
  '.pps': 'ppt',
  '.pot': 'ppt',
  '.pptx': 'pptx',
  '.pptm': 'pptx',
  '.ppsx': 'pptx',
  '.ppsm': 'pptx',
  '.xls': 'xlsx',
  '.xlsx': 'xlsx',
  '.xlsm': 'xlsx',
  '.xlsb': 'xlsx',
  '.csv': 'csv',
  '.odt': 'odt',
  '.ods': 'ods',
  '.odp': 'odp',
  '.rtf': 'rtf',
  '.epub': 'epub',
};

const passthroughKinds = new Set<SourceKind>(['markdown', 'plain-text', 'html']);

export function detectSourceKind(fileName: string): SourceKind {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) {
    return 'unsupported';
  }
  const extension = fileName.slice(dot).toLowerCase();
  return extensionToKind[extension] ?? 'unsupported';
}

export function isPassthroughKind(kind: SourceKind): boolean {
  return passthroughKinds.has(kind);
}

export function isAnydocKind(kind: SourceKind): boolean {
  return kind !== 'unsupported' && kind !== 'image' && !isPassthroughKind(kind);
}
