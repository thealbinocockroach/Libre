async function nativeFetch(url: string): Promise<{ ok: boolean; text?: string }> {
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false };
    const text = await res.text();
    return { ok: true, text };
  } catch {
    return { ok: false };
  }
}

export interface FetchedBook {
  fullText: string;
  chapters: BookChapter[];
  sourceUrl: string;
  gutenbergId?: number;
}

export interface BookChapter {
  id: string;
  title: string;
  paragraphs: string[];
}

function stripGutenbergBoilerplate(text: string): string {
  let clean = text.replace(/\r\n?/g, '\n');

  const startMarker = clean.search(/\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\*]*\*\*\*/i);
  if (startMarker !== -1) {
    const afterMarker = clean.indexOf('\n', startMarker);
    if (afterMarker !== -1) clean = clean.substring(afterMarker).trim();
  }

  const endMarker = clean.search(/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i);
  if (endMarker !== -1) clean = clean.substring(0, endMarker).trim();

  return clean;
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

function detectChapters(paragraphs: string[]): { title: string; startIdx: number }[] {
  const chapterRegex = /^(?:CHAPTER|Chapter|Book|BOOK|ACT|Act|SCENE|Scene|SECTION|Section|Part|PART|Letter|LETTER)\s+([0-9IVXLCDM]+(?:[.:\s–-]+.+)?)$/i;
  const matches: { title: string; startIdx: number }[] = [];

  paragraphs.forEach((p, i) => {
    const match = p.match(chapterRegex);
    if (match && p.length < 120) {
      matches.push({ title: p, startIdx: i });
    }
  });

  return matches.length > 1 ? matches : [{ title: 'Chapter 1', startIdx: 0 }];
}

export function parseTextToChapters(text: string, bookTitle: string): BookChapter[] {
  const clean = stripGutenbergBoilerplate(text);
  const paragraphs = splitIntoParagraphs(clean);
  const chapterMarkers = detectChapters(paragraphs);

  const chapters: BookChapter[] = [];
  chapterMarkers.forEach((marker, i) => {
    const start = marker.startIdx;
    const end = i < chapterMarkers.length - 1 ? chapterMarkers[i + 1].startIdx : paragraphs.length;
    const chapterParagraphs = paragraphs.slice(start, end).filter(p => p !== marker.title);
    chapters.push({
      id: `ch_${i + 1}`,
      title: marker.title || `Chapter ${i + 1}`,
      paragraphs: chapterParagraphs.length > 0 ? chapterParagraphs : paragraphs.slice(start, end),
    });
  });

  if (chapters.length === 0) {
    chapters.push({ id: 'ch_1', title: bookTitle || 'Chapter 1', paragraphs });
  }

  return chapters;
}

async function tryDirectGutenbergUrls(gutenbergId: number): Promise<FetchedBook | null> {
  const urls = [
    `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`,
    `https://www.gutenberg.org/files/${gutenbergId}/${gutenbergId}-0.txt`,
    `https://www.gutenberg.org/ebooks/${gutenbergId}.txt.utf-8`,
    `https://gutenberg.readingroo.ms/${gutenbergId}/${gutenbergId}-0.txt`,
  ];

  for (const url of urls) {
    const { ok, text } = await nativeFetch(url);
    if (ok && text && text.length > 500) {
      const chapters = parseTextToChapters(text, '');
      if (chapters.some(c => c.paragraphs.length > 0)) {
        return { fullText: text, chapters, sourceUrl: url, gutenbergId };
      }
    }
  }
  return null;
}

async function gutendexLookup(id: number) {
  const { ok, text } = await nativeFetch(`https://gutendex.com/books/${id}`);
  if (ok && text) return JSON.parse(text);
  return null;
}

async function gutendexSearch(query: string) {
  const { ok, text } = await nativeFetch(`https://gutendex.com/books/?search=${encodeURIComponent(query)}`);
  if (ok && text) {
    const data = JSON.parse(text);
    return data.results?.[0] || null;
  }
  return null;
}

async function fetchFromFormats(formats: Record<string, string>, gutenbergId: number): Promise<FetchedBook | null> {
  const txtUrl = formats['text/plain; charset=us-ascii'] || formats['text/plain'] || formats['text/plain; charset=utf-8'];
  if (txtUrl) {
    const { ok, text } = await nativeFetch(txtUrl);
    if (ok && text && text.length > 500) {
      const chapters = parseTextToChapters(text, '');
      if (chapters.some(c => c.paragraphs.length > 0)) {
        return { fullText: text, chapters, sourceUrl: txtUrl, gutenbergId };
      }
    }
  }
  return null;
}

export async function fetchBookText(gutenbergId: number | undefined, title: string): Promise<FetchedBook | null> {
  if (gutenbergId) {
    const direct = await tryDirectGutenbergUrls(gutenbergId);
    if (direct) return direct;
  }

  if (gutenbergId) {
    const book = await gutendexLookup(gutenbergId);
    if (book?.formats) {
      const fromFormats = await fetchFromFormats(book.formats, gutenbergId);
      if (fromFormats) return fromFormats;
    }
  }

  const searchBook = await gutendexSearch(title);
  if (searchBook?.formats) {
    const fromFormats = await fetchFromFormats(searchBook.formats, searchBook.id);
    if (fromFormats) return fromFormats;
  }

  const cleanTitle = title
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\s*\[.*?\]/g, '')
    .replace(/,\s*or\s+.*$/i, '')
    .replace(/:\s*.*$/, '')
    .trim();

  if (cleanTitle !== title) {
    const altBook = await gutendexSearch(cleanTitle);
    if (altBook?.formats) {
      const fromFormats = await fetchFromFormats(altBook.formats, altBook.id);
      if (fromFormats) return fromFormats;
    }
  }

  return null;
}