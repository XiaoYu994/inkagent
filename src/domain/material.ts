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
export type MaterialExtractionStatus = 'ok' | 'unsupported' | 'error';

export type SourceFile = {
  relativePath: string;
};

type MaterialExtractionBase = {
  sourcePath: string;
  kind: SourceKind;
};

export type MaterialExtraction =
  | (MaterialExtractionBase & {
      status: 'ok';
      extractedPath: string;
    })
  | (MaterialExtractionBase & {
      status: 'unsupported' | 'error';
      errorMessage: string;
    });
