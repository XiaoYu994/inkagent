import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { formatError } from '../errors.js';
import { convertDocumentToMarkdown } from './extractAnydoc.js';
import { detectSourceKind, isPassthroughKind, type SourceKind } from './sourceKind.js';

export type ExtractStatus = 'ok' | 'unsupported' | 'error';

export type ExtractRecord = {
  sourcePath: string;
  kind: SourceKind;
  status: ExtractStatus;
  extractPath: string | undefined;
  errorMessage: string | undefined;
};

export async function extractInputFiles(
  inputDir: string,
  extractDir: string,
  sourcePaths: string[],
): Promise<ExtractRecord[]> {
  const records: ExtractRecord[] = [];
  for (const sourcePath of sourcePaths) {
    records.push(await extractOneFile(inputDir, extractDir, sourcePath));
  }
  return records;
}

async function extractOneFile(
  inputDir: string,
  extractDir: string,
  sourcePath: string,
): Promise<ExtractRecord> {
  const kind = detectSourceKind(sourcePath);
  const absoluteSource = join(inputDir, sourcePath);

  if (kind === 'unsupported') {
    return {
      sourcePath,
      kind,
      status: 'unsupported',
      extractPath: undefined,
      errorMessage: `暂不支持该文件类型: ${sourcePath}`,
    };
  }

  if (kind === 'image') {
    const extractPath = sourcePath;
    await mkdir(dirname(join(extractDir, extractPath)), { recursive: true });
    await cp(absoluteSource, join(extractDir, extractPath));
    return { sourcePath, kind, status: 'ok', extractPath, errorMessage: undefined };
  }

  try {
    const text = isPassthroughKind(kind)
      ? (await readFile(absoluteSource, 'utf8')).trim()
      : await convertDocumentToMarkdown(absoluteSource);
    const extractPath = `${sourcePath}.md`;
    const destination = join(extractDir, extractPath);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, `${text}\n`, 'utf8');
    return { sourcePath, kind, status: 'ok', extractPath, errorMessage: undefined };
  } catch (error) {
    return {
      sourcePath,
      kind,
      status: 'error',
      extractPath: undefined,
      errorMessage: `抽取失败 ${sourcePath}: ${formatError(error)}`,
    };
  }
}
