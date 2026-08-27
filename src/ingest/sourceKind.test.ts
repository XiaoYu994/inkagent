import { describe, expect, it } from 'vitest';

import { detectSourceKind, isAnydocKind } from './sourceKind.js';

describe('detectSourceKind', () => {
  it('maps common document extensions', () => {
    expect(detectSourceKind('notes.md')).toBe('markdown');
    expect(detectSourceKind('a.PDF')).toBe('pdf');
    expect(detectSourceKind('spec.docx')).toBe('docx');
    expect(detectSourceKind('deck.pptx')).toBe('pptx');
    expect(detectSourceKind('sheet.xlsx')).toBe('xlsx');
    expect(detectSourceKind('photo.png')).toBe('image');
  });

  it('returns unsupported when the extension is unknown', () => {
    expect(detectSourceKind('archive.zip')).toBe('unsupported');
    expect(detectSourceKind('README')).toBe('unsupported');
  });

  it('routes office formats to anydoc', () => {
    expect(isAnydocKind('pdf')).toBe(true);
    expect(isAnydocKind('docx')).toBe(true);
    expect(isAnydocKind('markdown')).toBe(false);
    expect(isAnydocKind('image')).toBe(false);
  });
});
