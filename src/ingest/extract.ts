import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import { formatError } from '../errors.js';
import { convertOfficeDocument, convertPdfToMarkdown, type ConvertedAsset } from './anydoc.js';
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
    const mdSuffix = kind === 'markdown' ? '' : '.md';
    const extractPath = `${kind}/${sourcePath}${mdSuffix}`;
    const destination = join(extractDir, extractPath);
    const text = isAnydocKind(kind)
      ? await extractAnydocSource(kind, absoluteSource, destination, sourcePath)
      : (await readFile(absoluteSource, 'utf8')).trim();
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

async function extractAnydocSource(
  kind: SourceKind,
  absoluteSource: string,
  destination: string,
  sourcePath: string,
): Promise<string> {
  if (kind === 'pdf') {
    return convertPdfToMarkdown(absoluteSource);
  }

  const assetFolder = `${basename(sourcePath)}.assets`;
  const converted = await convertOfficeDocument(
    absoluteSource,
    assetHrefDir(kind, sourcePath, assetFolder),
  );
  await writeConvertedAssets(dirname(destination), converted.assets, assetFolder);
  return converted.markdown;
}

function assetHrefDir(kind: SourceKind, sourcePath: string, assetFolder: string): string {
  const parent = dirname(sourcePath).replaceAll('\\', '/');
  if (parent === '.') {
    return `extract/${kind}/${assetFolder}`;
  }
  return `extract/${kind}/${parent}/${assetFolder}`;
}

async function writeConvertedAssets(
  directory: string,
  assets: ConvertedAsset[],
  assetDirectoryName: string,
): Promise<void> {
  if (assets.length === 0) {
    return;
  }
  const assetDir = join(directory, assetDirectoryName);
  await mkdir(assetDir, { recursive: true });
  for (const asset of assets) {
    await writeFile(join(assetDir, asset.fileName), asset.data);
  }
}
