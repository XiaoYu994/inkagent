import type { Document } from '@firecrawl/anydoc';
import { describe, expect, it } from 'vitest';

import { documentToMarkdown } from './documentToMarkdown.js';

describe('documentToMarkdown', () => {
  it('drops consecutive short unpunctuated paragraphs from drawings', () => {
    const markdown = documentToMarkdown(
      documentWithParagraphs(['PSD', '(g2/Hz)', 'f', '(Hz)', '2000', '正式段落，有标点。']),
      new Map(),
    );

    expect(markdown).toBe('正式段落，有标点。');
    expect(markdown).not.toContain('PSD');
    expect(markdown).not.toContain('layout-debris');
  });

  it('drops cover tables and toc before the first level-one heading', () => {
    const markdown = documentToMarkdown(
      {
        blocks: [
          {
            kind: 'table',
            table: {
              kind: 'data',
              headerRows: 1,
              grid: [
                [
                  {
                    kind: 'origin',
                    cell: {
                      colSpan: 1,
                      rowSpan: 1,
                      blocks: [{ kind: 'paragraph', content: [{ kind: 'text', text: '密级' }] }],
                    },
                  },
                ],
              ],
            },
          },
          { kind: 'paragraph', content: [{ kind: 'text', text: '目 次' }] },
          { kind: 'paragraph', content: [{ kind: 'text', text: '1 范围 1' }] },
          {
            kind: 'heading',
            level: 1,
            content: [{ kind: 'text', text: '1 范围' }],
          },
          { kind: 'paragraph', content: [{ kind: 'text', text: '本规范规定了要求。' }] },
        ],
        notes: [],
        assets: [],
      } as unknown as Document,
      new Map(),
    );

    expect(markdown).toContain('# 1 范围');
    expect(markdown).toContain('本规范规定了要求。');
    expect(markdown).not.toContain('密级');
    expect(markdown).not.toContain('目 次');
  });

  it('keeps the whole document when there is no level-one heading', () => {
    const markdown = documentToMarkdown(
      documentWithParagraphs(['封面签字', '正文段落。']),
      new Map(),
    );

    expect(markdown).toContain('封面签字');
    expect(markdown).toContain('正文段落。');
  });

  it('keeps a lone short paragraph as body text', () => {
    const markdown = documentToMarkdown(documentWithParagraphs(['注']), new Map());

    expect(markdown).toBe('注');
    expect(markdown).not.toContain('layout-debris');
  });

  it('omits raster images that only appear before the first level-one heading', () => {
    const markdown = documentToMarkdown(
      {
        blocks: [
          {
            kind: 'paragraph',
            content: [{ kind: 'image', alt: '封面徽标', source: { kind: 'asset', assetId: 0 } }],
          },
          { kind: 'heading', level: 1, content: [{ kind: 'text', text: '1 范围' }] },
          {
            kind: 'paragraph',
            content: [{ kind: 'image', alt: '图1', source: { kind: 'asset', assetId: 1 } }],
          },
        ],
        notes: [],
        assets: [],
      } as unknown as Document,
      new Map([
        [0, 'extract/docx/a.docx.assets/image-0.png'],
        [1, 'extract/docx/a.docx.assets/image-1.png'],
      ]),
    );

    expect(markdown).not.toContain('封面徽标');
    expect(markdown).not.toContain('image-0.png');
    expect(markdown).toContain('![图1](extract/docx/a.docx.assets/image-1.png)');
  });

  it('labels layout tables and emits raster images as markdown', () => {
    const markdown = documentToMarkdown(
      {
        blocks: [
          {
            kind: 'table',
            table: {
              kind: 'layout',
              headerRows: 1,
              grid: [
                [
                  {
                    kind: 'origin',
                    cell: {
                      colSpan: 1,
                      rowSpan: 1,
                      blocks: [{ kind: 'paragraph', content: [{ kind: 'text', text: '密级' }] }],
                    },
                  },
                ],
              ],
            },
          },
          {
            kind: 'paragraph',
            content: [{ kind: 'image', alt: '图5', source: { kind: 'asset', assetId: 0 } }],
          },
          {
            kind: 'paragraph',
            content: [
              {
                kind: 'image',
                alt: 'Embedded object: Visio.Drawing.11',
                source: { kind: 'asset', assetId: 2 },
              },
            ],
          },
        ],
        notes: [],
        assets: [],
      } as unknown as Document,
      new Map([[0, 'extract/docx/a.docx.assets/image-0.png']]),
    );

    expect(markdown).toContain('排版框（非数据表）');
    expect(markdown).toContain('![图5](extract/docx/a.docx.assets/image-0.png)');
    expect(markdown).toContain('嵌入对象未能转成图片：Embedded object: Visio.Drawing.11');
  });
});

function documentWithParagraphs(texts: string[]): Document {
  return {
    blocks: texts.map((text) => ({
      kind: 'paragraph' as const,
      content: [{ kind: 'text' as const, text }],
    })),
    notes: [],
    assets: [],
  } as unknown as Document;
}
