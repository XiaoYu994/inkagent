import { readFile } from 'node:fs/promises';

import {
  formatFromPath,
  toDocument,
  toMarkdown,
  type Asset,
  type Document,
} from '@firecrawl/anydoc';

import { InkAgentError, formatError } from '../errors.js';
import {
  blocksFromFirstLevelOneHeading,
  documentToMarkdown,
  referencedAssetIds,
} from './documentToMarkdown.js';

export type ConvertedAsset = {
  fileName: string;
  data: Buffer;
};

export type ConvertedDocument = {
  markdown: string;
  assets: ConvertedAsset[];
};

const rasterExtensionByMediaType: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

export async function convertPdfToMarkdown(filePath: string): Promise<string> {
  return convertWithAnydoc(() => toMarkdown(filePath), filePath);
}

export async function convertOfficeDocument(
  filePath: string,
  assetDirectoryName: string,
): Promise<ConvertedDocument> {
  const bytes = await readFile(filePath);
  const document = await convertWithAnydoc(
    () => toDocument(bytes, formatFromPath(filePath)),
    filePath,
  );
  const converted = serializeOfficeDocument(document, assetDirectoryName);
  if (converted.markdown.length === 0) {
    throw new InkAgentError(`anydoc 没有从 ${filePath} 抽出有效 Markdown`);
  }
  return converted;
}

function serializeOfficeDocument(
  document: Document,
  assetDirectoryName: string,
): ConvertedDocument {
  const bodyBlocks = blocksFromFirstLevelOneHeading(document.blocks);
  const usedAssetIds = referencedAssetIds(bodyBlocks);
  const assets: ConvertedAsset[] = [];
  const imageHrefByAssetId = new Map<number, string>();

  for (const asset of document.assets) {
    if (!usedAssetIds.has(asset.id)) {
      continue;
    }
    const fileName = rasterAssetFileName(asset);
    if (fileName === undefined) {
      continue;
    }
    assets.push({ fileName, data: Buffer.from(asset.data) });
    imageHrefByAssetId.set(asset.id, `${assetDirectoryName}/${fileName}`);
  }

  const bodyDocument = { ...document, blocks: [...bodyBlocks] };
  return { markdown: documentToMarkdown(bodyDocument, imageHrefByAssetId), assets };
}

function rasterAssetFileName(asset: Asset): string | undefined {
  const extension = rasterExtensionByMediaType[asset.mediaType];
  if (extension === undefined) {
    return undefined;
  }
  return `image-${asset.id}${extension}`;
}

async function convertWithAnydoc<T>(operation: () => Promise<T>, filePath: string): Promise<T> {
  try {
    const result = await operation();
    if (typeof result === 'string' && result.trim().length === 0) {
      throw new InkAgentError(`anydoc 没有从 ${filePath} 抽出有效 Markdown`);
    }
    return result;
  } catch (error) {
    if (error instanceof InkAgentError) {
      throw error;
    }
    const code = convertErrorCode(error);
    const suffix = code === undefined ? '' : ` (${code})`;
    throw new InkAgentError(`anydoc 解析失败: ${filePath}${suffix}: ${formatError(error)}`, {
      cause: error,
    });
  }
}

function convertErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = error.code;
    if (typeof code === 'string') {
      return code;
    }
  }
  return undefined;
}
