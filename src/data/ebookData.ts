import { EbookChapter } from '../types';
import { httpGetText, httpGetJson } from '../utils/httpClient';

/* =========================================================================
   GUTENDEX API LOOKUP + GUTENBERG FETCH + CORS BYPASS + CONTENT SANITIZATION
   ========================================================================= */

/**
 * Metadata map: internal book ID → Gutenberg ID.
 */
export const CLASSIC_EBOOKS: Record<string, { gutenbergId: number }> = {
  '47':  { gutenbergId: 1661 },  // The Adventures of Sherlock Holmes
  '12':  { gutenbergId: 1342 },  // Pride and Prejudice
  '52':  { gutenbergId: 84 },    // Frankenstein
  '19':  { gutenbergId: 35 },    // The Time Machine
  '25':  { gutenbergId: 174 },   // The Picture of Dorian Gray
  '88':  { gutenbergId: 5200 },  // Metamorphosis
  '17':  { gutenbergId: 345 },   // Dracula
  '150': { gutenbergId: 345 },   // Dracula (alternate entry)
  '42':  { gutenbergId: 43 },    // Dr Jekyll and Mr Hyde
  '108': { gutenbergId: 2148 },  // The Tell-Tale Heart
  '201': { gutenbergId: 1322 },  // Leaves of Grass
  '11':  { gutenbergId: 11 },    // Alice's Adventures in Wonderland
};

/**
 * Returns Gutenberg ID metadata for a book.
 */
export function findClassicEbook(book: { id?: string; title?: string; gutenbergId?: number }): { gutenbergId: number } | null {
  if (!book) return null;

  if (book.id && CLASSIC_EBOOKS[book.id]) {
    return { gutenbergId: CLASSIC_EBOOKS[book.id].gutenbergId };
  }

  if (book.gutenbergId) {
    return { gutenbergId: book.gutenbergId };
  }

  const title = (book.title || '').toLowerCase();
  if (title) {
    if (title.includes('sherlock'))            return { gutenbergId: 1661 };
    if (title.includes('pride and prejudice') || title.includes('prejudice'))
                                               return { gutenbergId: 1342 };
    if (title.includes('frankenstein'))         return { gutenbergId: 84 };
    if (title.includes('time machine'))         return { gutenbergId: 35 };
    if (title.includes('dorian gray'))          return { gutenbergId: 174 };
    if (title.includes('metamorphosis'))        return { gutenbergId: 5200 };
    if (title.includes('dracula'))              return { gutenbergId: 345 };
    if (title.includes('jekyll') || title.includes('hyde'))
                                               return { gutenbergId: 43 };
    if (title.includes('tell-tale') || title.includes('amontillado') || title.includes('edgar allan poe'))
                                               return { gutenbergId: 2148 };
    if (title.includes('leaves of grass') || title.includes('whitman'))
                                               return { gutenbergId: 1322 };
    if (title.includes('alice'))                return { gutenbergId: 11 };
  }

  return null;
}

/* --------------------------------------------------------------------------
   HTTP: Timeout + retry + formatted errors via httpClient.ts
   -------------------------------------------------------------------------- */

async function nativeFetch(url: string): Promise<{ ok: boolean; text: string; status: number }> {
  const result = await httpGetText(url, {
    timeout: 15000,
    retries: 2,
    headers: { Accept: 'text/plain, text/html, application/xhtml+xml, */*' },
  });
  return { ok: result.ok, text: result.data || '', status: result.status };
}

async function nativeFetchJson(url: string): Promise<{ ok: boolean; data: any; status: number }> {
  const result = await httpGetJson(url, {
    timeout: 15000,
    retries: 2,
    headers: { Accept: 'application/json, */*' },
  });
  return { ok: result.ok, data: result.data, status: result.status };
}

/* --------------------------------------------------------------------------
   CONTENT SANITIZATION: Strip Gutenberg boilerplate headers/footers
   -------------------------------------------------------------------------- */

export function stripGutenbergBoilerplate(text: string): string {
  if (!text) return '';

  let clean = text;

  // Strip START marker and everything before it
  const startMatch = clean.search(/\*\*\*\s*START\s+(?:OF\s+)?(?:THE|THIS)\s+PROJECT\s+GUTENBERG\s+EBOOK[^\*]*\*\*\*/i);
  if (startMatch !== -1) {
    const afterMarker = clean.indexOf('\n', startMatch);
    if (afterMarker !== -1) {
      clean = clean.substring(afterMarker).trim();
    }
  }

  // Strip END marker and everything after it
  const endMatch = clean.search(/\*\*\*\s*END\s+(?:OF\s+)?(?:THE|THIS)\s+PROJECT\s+GUTENBERG\s+EBOOK[^\*]*\*\*\*/i);
  if (endMatch !== -1) {
    clean = clean.substring(0, endMatch).trim();
  }

  // Strip common Gutenberg trailing license/legal block
  const licenseMatch = clean.search(/End\s+of\s+(?:the\s+)?Project\s+Gutenberg/i);
  if (licenseMatch !== -1) {
    clean = clean.substring(0, licenseMatch).trim();
  }

  return clean;
}

/* --------------------------------------------------------------------------
   HTML → READABLE TEXT: Gutenberg HTML editions must be converted, not
   dumped raw. Strip tags, decode entities, collapse whitespace.
   -------------------------------------------------------------------------- */

function decodeHtmlEntities(input: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
    '&nbsp;': ' ', '&#39;': "'", '&ldquo;': '"', '&rdquo;': '"',
    '&lsquo;': "'", '&rsquo;': "'", '&mdash;': '—', '&ndash;': '–',
    '&hellip;': '…', '&eacute;': 'é', '&egrave;': 'è', '&agrave;': 'à',
    '&ugrave;': 'ù', '&ocirc;': 'ô', '&ccedil;': 'ç', '&uuml;': 'ü',
  };
  return input
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&[a-z]+;/gi, (m) => entities[m.toLowerCase()] ?? m);
}

function htmlToReadableText(html: string): string {
  if (!html) return '';
  let text = html;

  // Drop script/style/head blocks entirely
  text = text.replace(/<(script|style|head)[^>]*>[\s\S]*?<\/(script|style|head)>/gi, ' ');
  // Convert block-level breaks to newlines
  text = text.replace(/<\s*(br|\/p|\/div|\/h[1-6]|\/li|\/tr|\/section|\/article)[^>]*>/gi, '\n');
  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode entities
  text = decodeHtmlEntities(text);
  // Collapse runs of whitespace into a single space, keep paragraph breaks
  text = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

/* --------------------------------------------------------------------------
   GUTENDEX API LOOKUP: find books by Gutenberg ID, title, or author
   -------------------------------------------------------------------------- */

interface GutendexBook {
  id: number;
  title: string;
  authors: { name: string }[];
  formats: Record<string, string>;
}

/**
 * Look up a book on Gutendex by Gutenberg ID.
 */
async function gutendexLookupById(gutenbergId: number): Promise<GutendexBook | null> {
  const { ok, data } = await nativeFetchJson(`https://gutendex.com/books/${gutenbergId}`);
  if (ok && data) return data as GutendexBook;
  return null;
}

/**
 * Search Gutendex by title (and optionally author) to find a matching book.
 */
async function gutendexSearch(query: string): Promise<GutendexBook | null> {
  const { ok, data } = await nativeFetchJson(
    `https://gutendex.com/books/?search=${encodeURIComponent(query)}`
  );
  if (ok && data?.results?.length > 0) {
    return data.results[0] as GutendexBook;
  }
  return null;
}

/* --------------------------------------------------------------------------
   FORMAT FALLBACK CHAIN: Try HTML → EPUB → TXT in order of preference
   -------------------------------------------------------------------------- */

interface FormatResult {
  url: string;
  format: 'html' | 'epub' | 'txt';
  text?: string;
}

/**
 * Extract the best available format URL from a Gutendex book's formats map.
 * Priority: text/html > text/html; charset=utf-8 > text/plain; charset=utf-8 > text/plain > application/epub+zip
 */
function pickBestFormat(formats: Record<string, string>): FormatResult | null {
  // Priority order for formats
  const formatPriority: [RegExp, 'html' | 'txt' | 'epub'][] = [
    [/^text\/html/i, 'html'],
    [/^text\/plain/i, 'txt'],
    [/^application\/epub/i, 'epub'],
  ];

  for (const [regex, formatType] of formatPriority) {
    for (const [mimeType, url] of Object.entries(formats)) {
      if (regex.test(mimeType) && url) {
        return { url, format: formatType };
      }
    }
  }

  return null;
}

/* --------------------------------------------------------------------------
   MAIN FETCH FUNCTIONS
   -------------------------------------------------------------------------- */

export interface FetchEbookResult {
  text: string;
  format: 'html' | 'epub' | 'txt';
  gutenbergId?: number;
  sourceUrl: string;
  chapters?: EbookChapter[];
}

/**
 * Fetch ebook content with full format fallback chain.
 * Steps:
 *   1. Try direct Gutenberg text URL (fastest, no API)
 *   2. Gutendex lookup by Gutenberg ID → pick best format
 *   3. Gutendex search by title → pick best format
 *   4. For HTML format: fetch and convert to text
 *   5. For TXT: fetch plain text directly
 */
export async function fetchEbookContent(
  gutenbergId: number | undefined,
  title: string,
): Promise<FetchEbookResult | null> {

  // Step 1: Direct Gutenberg text URLs (fastest path, works for most classics)
  if (gutenbergId) {
    const mirrorUrls = [
      `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`,
      `https://www.gutenberg.org/files/${gutenbergId}/${gutenbergId}-0.txt`,
      `https://www.gutenberg.org/ebooks/${gutenbergId}.txt.utf-8`,
      `https://gutenberg.readingroo.ms/${gutenbergId}/${gutenbergId}-0.txt`,
    ];
    for (const directUrl of mirrorUrls) {
      const { ok, text } = await nativeFetch(directUrl);
      if (ok && text && text.length > 500) {
        const cleaned = stripGutenbergBoilerplate(text);
        if (cleaned.length > 500) {
          return { text: cleaned, format: 'txt', gutenbergId, sourceUrl: directUrl };
        }
      }
    }
  }

  // Step 2: Gutendex lookup by Gutenberg ID
  if (gutenbergId) {
    const book = await gutendexLookupById(gutenbergId);
    if (book?.formats) {
      const result = await fetchBestFormat(book.formats, gutenbergId);
      if (result) return result;
    }
  }

  // Step 3: Gutendex search by title
  const searchBook = await gutendexSearch(title);
  if (searchBook?.formats) {
    const result = await fetchBestFormat(searchBook.formats, searchBook.id);
    if (result) return result;
  }

  // Step 4: Try broader search with cleaned title
  const cleanTitle = title
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\s*\[.*?\]/g, '')
    .replace(/,\s*or\s+.*$/i, '')
    .replace(/:\s*.*$/, '')
    .trim();

  if (cleanTitle !== title) {
    const altBook = await gutendexSearch(cleanTitle);
    if (altBook?.formats) {
      const result = await fetchBestFormat(altBook.formats, altBook.id);
      if (result) return result;
    }
  }

  return null;
}

/**
 * Fetch content using the best available format from a Gutendex formats map.
 */
async function fetchBestFormat(
  formats: Record<string, string>,
  gutenbergId: number,
): Promise<FetchEbookResult | null> {
  const candidates = getAllFormatCandidates(formats);

  for (const candidate of candidates) {
    if (candidate.format === 'txt' || candidate.format === 'html') {
      const { ok, text } = await nativeFetch(candidate.url);
      if (ok && text && text.length > 500) {
        let processed = text;
        let resolvedFormat = candidate.format;

        // HTML editions must be converted to readable text
        if (candidate.format === 'html') {
          const converted = htmlToReadableText(text);
          if (converted.length > 500) {
            processed = converted;
            resolvedFormat = 'txt';
          } else {
            // Fallback: keep raw but strip boilerplate if conversion failed
            processed = stripGutenbergBoilerplate(text);
          }
        } else {
          processed = stripGutenbergBoilerplate(text);
        }

        if (processed.length > 500) {
          return { text: processed, format: resolvedFormat, gutenbergId, sourceUrl: candidate.url };
        }
      }
    }
    // EPUB format: we don't parse EPUBs from URLs in this path
    // (EPUB parsing is handled separately via file upload)
  }

  return null;
}

/**
 * Get all format candidates sorted by priority.
 */
function getAllFormatCandidates(formats: Record<string, string>): FormatResult[] {
  const results: FormatResult[] = [];

  for (const [mimeType, url] of Object.entries(formats)) {
    if (!url) continue;
    if (/^text\/plain/i.test(mimeType)) {
      results.push({ url, format: 'txt' });
    } else if (/^text\/html/i.test(mimeType)) {
      results.push({ url, format: 'html' });
    } else if (/^application\/epub/i.test(mimeType)) {
      results.push({ url, format: 'epub' });
    }
  }

  return results;
}
