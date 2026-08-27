import JSZip from 'jszip';

export async function extractPptxText(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const slidePaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort();

  const slides: string[] = [];
  for (const slidePath of slidePaths) {
    const file = zip.file(slidePath);
    if (!file) {
      continue;
    }
    const xml = await file.async('string');
    const text = xml
      .replace(/<a:t[^>]*>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 0) {
      slides.push(text);
    }
  }

  return slides.join('\n\n').trim();
}
