import type { SourceKind } from '../domain/material.js';

export { sourceKinds } from '../domain/material.js';
export type { SourceKind } from '../domain/material.js';

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

export function detectSourceKind(fileName: string): SourceKind {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) {
    return 'unsupported';
  }
  const extension = fileName.slice(dot).toLowerCase();
  return extensionToKind[extension] ?? 'unsupported';
}

const nonAnydocKinds = new Set<SourceKind>([
  'unsupported',
  'image',
  'markdown',
  'plain-text',
  'html',
]);

export type AnydocKind = Exclude<
  SourceKind,
  'unsupported' | 'image' | 'markdown' | 'plain-text' | 'html'
>;

export function isAnydocKind(kind: SourceKind): kind is AnydocKind {
  return !nonAnydocKinds.has(kind);
}
