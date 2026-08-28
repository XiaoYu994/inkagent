import type { Block, Document, Inline, List, Table } from '@firecrawl/anydoc';

const maxDebrisChars = 12;
const minDroppedDebrisLines = 3;
const sentencePunctuation = /[。！？；：!?，、]/;
const captionPattern = /^(图|表)\s*\d/;

export function documentToMarkdown(
  document: Document,
  imageHrefByAssetId: ReadonlyMap<number, string>,
): string {
  return serializeBlocks(
    blocksFromFirstLevelOneHeading(document.blocks),
    imageHrefByAssetId,
  ).trim();
}

export function blocksFromFirstLevelOneHeading(blocks: readonly Block[]): readonly Block[] {
  const start = blocks.findIndex((block) => isLevelOneHeading(block));
  if (start <= 0) {
    return blocks;
  }
  return blocks.slice(start);
}

export function referencedAssetIds(blocks: readonly Block[]): Set<number> {
  const ids = new Set<number>();
  collectAssetIdsFromBlocks(blocks, ids);
  return ids;
}

function isLevelOneHeading(block: Block): boolean {
  return block.kind === 'heading' && (block.level ?? 1) === 1;
}

function collectAssetIdsFromBlocks(blocks: readonly Block[], ids: Set<number>): void {
  for (const block of blocks) {
    collectAssetIdsFromInlines(block.content ?? [], ids);
    collectAssetIdsFromBlocks(block.blocks ?? [], ids);
    for (const item of block.list?.items ?? []) {
      collectAssetIdsFromBlocks(item.blocks, ids);
    }
    for (const row of block.table?.grid ?? []) {
      for (const slot of row) {
        collectAssetIdsFromBlocks(slot.cell?.blocks ?? [], ids);
      }
    }
  }
}

function collectAssetIdsFromInlines(inlines: readonly Inline[], ids: Set<number>): void {
  for (const inline of inlines) {
    const assetId = inline.source?.assetId;
    if (inline.kind === 'image' && assetId !== undefined) {
      ids.add(assetId);
    }
    collectAssetIdsFromInlines(inline.content ?? [], ids);
  }
}

function serializeBlocks(
  blocks: readonly Block[],
  imageHrefByAssetId: ReadonlyMap<number, string>,
): string {
  const parts: string[] = [];
  let debris: string[] = [];

  for (const block of blocks) {
    if (isDebrisParagraph(block)) {
      debris.push(plainInlineText(block.content ?? []));
      continue;
    }
    flushDebris(parts, debris);
    debris = [];
    const rendered = serializeBlock(block, imageHrefByAssetId);
    if (rendered.length > 0) {
      parts.push(rendered);
    }
  }
  flushDebris(parts, debris);
  return parts.join('\n\n');
}

function flushDebris(parts: string[], debris: string[]): void {
  if (debris.length === 0 || debris.length >= minDroppedDebrisLines) {
    return;
  }
  parts.push(...debris);
}

function serializeBlock(block: Block, imageHrefByAssetId: ReadonlyMap<number, string>): string {
  switch (block.kind) {
    case 'heading':
      return `${'#'.repeat(block.level ?? 1)} ${serializeInlines(block.content ?? [], imageHrefByAssetId)}`;
    case 'paragraph':
      return serializeInlines(block.content ?? [], imageHrefByAssetId);
    case 'list':
      return block.list === undefined ? '' : serializeList(block.list, imageHrefByAssetId);
    case 'table':
      return block.table === undefined ? '' : serializeTable(block.table, imageHrefByAssetId);
    case 'blockQuote':
      return serializeBlocks(block.blocks ?? [], imageHrefByAssetId)
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
    case 'codeBlock':
      return `\`\`\`${block.lang ?? ''}\n${block.text ?? ''}\n\`\`\``;
    case 'rule':
      return '---';
    case 'math':
      return `$$\n${block.text ?? ''}\n$$`;
    default:
      return '';
  }
}

function serializeList(list: List, imageHrefByAssetId: ReadonlyMap<number, string>): string {
  return list.items
    .map((item, index) => {
      const marker = list.marker === 'bullet' ? '-' : `${list.start + index}.`;
      const body = serializeBlocks(item.blocks, imageHrefByAssetId).replaceAll('\n', '\n  ');
      return `${marker} ${body}`;
    })
    .join('\n');
}

function serializeTable(table: Table, imageHrefByAssetId: ReadonlyMap<number, string>): string {
  const rows = table.grid.map((row) =>
    row.map((slot) =>
      escapeCell(
        slot.kind === 'origin' ? cellText(slot.cell?.blocks ?? [], imageHrefByAssetId) : '',
      ),
    ),
  );
  if (rows.length === 0) {
    return '';
  }
  const width = Math.max(...rows.map((row) => row.length));
  const padded = rows.map((row) =>
    row.concat(Array.from({ length: width - row.length }, () => '')),
  );
  const header = padded[0] ?? [];
  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...padded.slice(1).map((row) => `| ${row.join(' | ')} |`),
  ];
  if (String(table.kind) === 'layout') {
    return `排版框（非数据表）：\n\n${lines.join('\n')}`;
  }
  return lines.join('\n');
}

function cellText(
  blocks: readonly Block[],
  imageHrefByAssetId: ReadonlyMap<number, string>,
): string {
  return blocks
    .map((block) => serializeBlock(block, imageHrefByAssetId))
    .join(' ')
    .replaceAll('\n', ' ')
    .trim();
}

function serializeInlines(
  inlines: readonly Inline[],
  imageHrefByAssetId: ReadonlyMap<number, string>,
): string {
  return inlines
    .map((inline) => {
      switch (inline.kind) {
        case 'text':
          return applyStyle(inline.text ?? '', inline.style);
        case 'link':
          return serializeInlines(inline.content ?? [], imageHrefByAssetId);
        case 'image':
          return serializeImage(inline, imageHrefByAssetId);
        case 'lineBreak':
          return '\n';
        case 'math':
          return `$${inline.text ?? ''}$`;
        case 'anchor':
        case 'noteRef':
        case 'checkbox':
          return '';
        default:
          return '';
      }
    })
    .join('');
}

function serializeImage(inline: Inline, imageHrefByAssetId: ReadonlyMap<number, string>): string {
  const assetId = inline.source?.assetId;
  const href = assetId === undefined ? undefined : imageHrefByAssetId.get(assetId);
  if (href === undefined) {
    const alt = inline.alt?.trim();
    return alt === undefined || alt.length === 0
      ? '（嵌入对象未能转成图片）'
      : `（嵌入对象未能转成图片：${alt}）`;
  }
  const alt = inline.alt?.trim() || '图';
  return `![${alt}](${href})`;
}

function applyStyle(text: string, style: Inline['style']): string {
  if (style === undefined || text.length === 0) {
    return text;
  }
  let rendered = text;
  if (style.code) {
    rendered = `\`${rendered}\``;
  }
  if (style.bold) {
    rendered = `**${rendered}**`;
  }
  if (style.italic) {
    rendered = `*${rendered}*`;
  }
  if (style.strike) {
    rendered = `~~${rendered}~~`;
  }
  return rendered;
}

function isDebrisParagraph(block: Block): boolean {
  if (block.kind !== 'paragraph') {
    return false;
  }
  const inlines = block.content ?? [];
  if (inlines.some((inline) => inline.kind === 'image')) {
    return false;
  }
  const text = plainInlineText(inlines);
  if (text.length === 0 || text.length > maxDebrisChars || captionPattern.test(text)) {
    return false;
  }
  return !sentencePunctuation.test(text);
}

function plainInlineText(inlines: readonly Inline[]): string {
  return inlines
    .map((inline) => {
      if (inline.kind === 'text') {
        return inline.text ?? '';
      }
      if (inline.kind === 'link') {
        return plainInlineText(inline.content ?? []);
      }
      return '';
    })
    .join('')
    .trim();
}

function escapeCell(text: string): string {
  return text.replaceAll('|', '\\|').replaceAll('\n', ' ');
}
