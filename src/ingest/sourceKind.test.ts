import { describe, expect, it } from 'vitest';

import { detectSourceKind } from './sourceKind.js';

describe('detectSourceKind', () => {
  it('maps common document extensions', () => {
    expect(detectSourceKind('notes.md')).toBe('markdown');
    expect(detectSourceKind('a.PDF')).toBe('pdf');
    expect(detectSourceKind('spec.docx')).toBe('docx');
    expect(detectSourceKind('deck.pptx')).toBe('pptx');
    expect(detectSourceKind('photo.png')).toBe('image');
  });

  it('returns unsupported when the extension is unknown', () => {
    expect(detectSourceKind('archive.zip')).toBe('unsupported');
    expect(detectSourceKind('README')).toBe('unsupported');
  });
});
