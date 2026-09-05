import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

import { formatError, InkAgentError } from '../errors.js';
import type { MaterialExtraction, SourceFile, SourceKind } from '../domain/material.js';
import { isPathInside } from '../shared/pathRelationship.js';
import { convertOfficeDocument, convertPdfToMarkdown, type ConvertedAsset } from './anydoc.js';
import { detectSourceKind, isAnydocKind } from './sourceKind.js';

export type { MaterialExtraction, MaterialExtractionStatus } from '../domain/material.js';

export type ExtractSourceFilesRequest = {
  inputDirectory: string;
  extractionDirectory: string;
  sourceFiles: readonly SourceFile[];
};

export async function extractSourceFiles(
  request: ExtractSourceFilesRequest,
): Promise<MaterialExtraction[]> {
  assertSourceFilesInsideInput(request);
  const records: MaterialExtraction[] = [];
  for (const sourceFile of request.sourceFiles) {
    records.push(await extractOneFile(request, sourceFile));
  }
  return records;
}

function assertSourceFilesInsideInput(request: ExtractSourceFilesRequest): void {
  for (const sourceFile of request.sourceFiles) {
    const sourcePath = sourceFile.relativePath;
    if (
      typeof sourcePath !== 'string' ||
      sourcePath.trim().length === 0 ||
      !isPathInside(resolve(request.inputDirectory, sourcePath), request.inputDirectory)
    ) {
      throw new InkAgentError(`材料路径无效: ${sourcePath}`);
    }
  }
}

async function extractOneFile(
  request: ExtractSourceFilesRequest,
  sourceFile: SourceFile,
): Promise<MaterialExtraction> {
  const sourcePath = sourceFile.relativePath;
  const kind = detectSourceKind(sourcePath);
  const absoluteSource = join(request.inputDirectory, sourcePath);

  if (kind === 'unsupported') {
    return {
      sourcePath,
      kind,
      status: 'unsupported',
      errorMessage: `暂不支持该文件类型: ${sourcePath}`,
    };
  }

  if (kind === 'image') {
    return copyImage({ request, kind, sourcePath, absoluteSource });
  }

  try {
    const mdSuffix = kind === 'markdown' ? '' : '.md';
    const extractedPath = `${kind}/${sourcePath}${mdSuffix}`;
    const destination = join(request.extractionDirectory, extractedPath);
    const text = isAnydocKind(kind)
      ? await extractAnydocSource({ kind, absoluteSource, destination, sourcePath })
      : (await readFile(absoluteSource, 'utf8')).trim();
    if (text.trim().length === 0) {
      throw new Error('文件内容为空');
    }
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, `${text}\n`, 'utf8');
    return { sourcePath, kind, status: 'ok', extractedPath };
  } catch (error) {
    return {
      sourcePath,
      kind,
      status: 'error',
      errorMessage: `抽取失败 ${sourcePath}: ${formatError(error)}`,
    };
  }
}

type CopyImageRequest = {
  request: ExtractSourceFilesRequest;
  kind: SourceKind;
  sourcePath: string;
  absoluteSource: string;
};

async function copyImage({
  request,
  kind,
  sourcePath,
  absoluteSource,
}: CopyImageRequest): Promise<MaterialExtraction> {
  const extractedPath = `${kind}/${sourcePath}`;
  const destination = join(request.extractionDirectory, extractedPath);

  try {
    await mkdir(dirname(destination), { recursive: true });
    await cp(absoluteSource, destination);
    return { sourcePath, kind: 'image', status: 'ok', extractedPath };
  } catch (error) {
    return {
      sourcePath,
      kind: 'image',
      status: 'error',
      errorMessage: `复制图片失败 ${sourcePath}: ${formatError(error)}`,
    };
  }
}

type ExtractAnydocSourceRequest = {
  kind: SourceKind;
  absoluteSource: string;
  destination: string;
  sourcePath: string;
};

async function extractAnydocSource({
  kind,
  absoluteSource,
  destination,
  sourcePath,
}: ExtractAnydocSourceRequest): Promise<string> {
  if (kind === 'pdf') {
    return convertPdfToMarkdown(absoluteSource);
  }

  const assetFolder = `${basename(sourcePath)}.assets`;
  const converted = await convertOfficeDocument(
    absoluteSource,
    createAssetHref({ kind, sourcePath, assetFolder }),
  );
  await writeConvertedAssets({
    directory: dirname(destination),
    assets: converted.assets,
    assetDirectoryName: assetFolder,
  });
  return converted.markdown;
}

type AssetHrefRequest = {
  kind: SourceKind;
  sourcePath: string;
  assetFolder: string;
};

function createAssetHref({ kind, sourcePath, assetFolder }: AssetHrefRequest): string {
  const parent = dirname(sourcePath).replaceAll('\\', '/');
  if (parent === '.') {
    return `extract/${kind}/${assetFolder}`;
  }
  return `extract/${kind}/${parent}/${assetFolder}`;
}

type WriteConvertedAssetsRequest = {
  directory: string;
  assets: ConvertedAsset[];
  assetDirectoryName: string;
};

async function writeConvertedAssets({
  directory,
  assets,
  assetDirectoryName,
}: WriteConvertedAssetsRequest): Promise<void> {
  if (assets.length === 0) {
    return;
  }
  const assetDir = join(directory, assetDirectoryName);
  await mkdir(assetDir, { recursive: true });
  for (const asset of assets) {
    await writeFile(join(assetDir, asset.fileName), asset.data);
  }
}
