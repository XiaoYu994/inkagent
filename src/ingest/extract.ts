import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { formatError } from '../errors.js';
import { convertDocumentToMarkdown } from './anydoc.js';
import { detectSourceKind, isAnydocKind, type SourceKind } from './sourceKind.js';

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

async function copyImage(
  extractDir: string,
  kind: SourceKind,
  sourcePath: string,
  absoluteSource: string,
): Promise<ExtractRecord> {
  const extractPath = `${kind}/${sourcePath}`;
  const destination = join(extractDir, extractPath);

  try {
    await mkdir(dirname(destination), { recursive: true });
    await cp(absoluteSource, destination);
    return { sourcePath, kind: 'image', status: 'ok', extractPath, errorMessage: undefined };
  } catch (error) {
    return {
      sourcePath,
      kind: 'image',
      status: 'error',
      extractPath: undefined,
      errorMessage: `复制图片失败 ${sourcePath}: ${formatError(error)}`,
    };
  }
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
    return copyImage(extractDir, kind, sourcePath, absoluteSource);
  }

  try {
    const text = isAnydocKind(kind)
      ? await convertDocumentToMarkdown(absoluteSource)
      : (await readFile(absoluteSource, 'utf8')).trim();
    // 原名保留在路径里，材料出处可追溯；kind 子目录避免抽取产物与原文混杂。
    const mdSuffix = kind === 'markdown' ? '' : '.md';
    const extractPath = `${kind}/${sourcePath}${mdSuffix}`;
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
