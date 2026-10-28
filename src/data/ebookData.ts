import { EbookChapter } from '../types';
import { httpGetText, httpGetJson } from '../utils/httpClient';

/* =========================================================================
   GUTENDEX API LOOKUP + GUTENBERG FETCH + CORS BYPASS + CONTENT SANITIZATION
   ========================================================================= */

/**
 * Returns Gutenberg ID metadata for a book.
 */
export function findClassicEbook(book: { id?: string; title?: string; gutenbergId?: number }): { gutenbergId: number } | null {
  if (!book) return null;

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
    timeout: 6000,
    retries: 0,
    headers: { Accept: 'text/plain, text/html, application/xhtml+xml, */*' },
  });
  return { ok: result.ok, text: result.data || '', status: result.status };
}

async function nativeFetchJson(url: string): Promise<{ ok: boolean; data: any; status: number }> {
  const result = await httpGetJson(url, {
    timeout: 6000,
    retries: 0,
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

/** Reject stale OCR/cache entries written in a language unrelated to an English title. */
export function isEbookTextCompatible(title: string, author: string, text: string): boolean {
  if (!text || text.trim().length < 500) return false;
  const identity = `${title} ${author}`;
  const identityLetters = identity.match(/\p{L}/gu) || [];
  const identityLatin = identity.match(/\p{Script=Latin}/gu) || [];
  if (identityLetters.length && identityLatin.length / identityLetters.length < 0.5) return true;

  const sample = text.slice(0, 12000);
  const normalizedSample = sample.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ');
  const titleTokens = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !['this', 'that', 'with', 'from', 'into'].includes(word));
  if (titleTokens.length && !titleTokens.some((word) => normalizedSample.includes(word))) return false;

  const letters = sample.match(/\p{L}/gu) || [];
  if (letters.length < 100) return false;
  const latin = sample.match(/\p{Script=Latin}/gu) || [];
  const words = sample.match(/[A-Za-z]{2,}/g) || [];
  return latin.length / letters.length >= 0.65 && words.length >= 50;
}

/** Load a public domain manuscript from a Wikisource page URL. */
export async function fetchWikisourceContent(pageUrl: string): Promise<FetchEbookResult | null> {
  let title: string;
  try {
    const url = new URL(pageUrl);
    if (url.hostname !== 'en.wikisource.org') return null;
    title = decodeURIComponent(url.pathname.replace(/^\/wiki\//, '').replace(/_/g, ' '));
  } catch {
    return null;
  }

  const apiUrl = `https://en.wikisource.org/w/api.php?action=query&prop=extracts&explaintext=1&exchars=100000&titles=${encodeURIComponent(title)}&format=json&origin=*`;
  const { ok, data } = await nativeFetchJson(apiUrl);
  if (!ok || !data?.query?.pages) return null;
  const page = Object.values(data.query.pages as Record<string, any>)[0];
  const text = typeof page?.extract === 'string' ? page.extract.trim() : '';
  if (text.length < 500) return null;
  return { text, format: 'txt', sourceUrl: pageUrl };
}

/**
 * Fetch ebook content from Gutenberg, then use Internet Archive OCR when its
 * Gutenberg download host is unreachable from the device.
 */
export async function fetchEbookContent(
  gutenbergId: number | undefined,
  title: string,
  author = '',
): Promise<FetchEbookResult | null> {
  if (gutenbergId) {
    const direct = await tryGutenbergFiles(gutenbergId, title, author);
    if (direct) return direct;
  }

  // Resolve one edition first when the catalog result has no Gutenberg ID.
  const book = gutenbergId
    ? await gutendexLookupById(gutenbergId)
    : await gutendexSearch(title);
  const resolvedId = book?.id || gutenbergId;

  // This legacy text route is reachable from some Android networks even when
  // Gutenberg's newer cache host stalls. Try the common edition suffixes.
  if (resolvedId && resolvedId !== gutenbergId) {
    const direct = await tryGutenbergFiles(resolvedId, title, author);
    if (direct) return direct;
  }

  // Gutendex format URLs remain a useful fallback on networks where the
  // standard Gutenberg cache is available.
  if (book?.formats) {
    const result = await fetchBestFormat(book.formats, resolvedId, title, author);
    if (result) return result;
  }

  // Internet Archive exposes OCR full text for many public-domain scans.
  // This recovers titles whose Gutenberg edition only redirects to a stalled
  // download host on the device.
  return fetchInternetArchiveText(title, author);
}

async function tryGutenbergFiles(
  gutenbergId: number,
  title: string,
  author: string,
): Promise<FetchEbookResult | null> {
  for (const suffix of ['-0.txt', '-8.txt']) {
    const url = `https://www.gutenberg.org/files/${gutenbergId}/${gutenbergId}${suffix}`;
    const direct = await tryPlainText(url, gutenbergId, title, author);
    if (direct) return direct;
  }
  return null;
}

async function tryPlainText(
  url: string,
  gutenbergId: number,
  title: string,
  author: string,
): Promise<FetchEbookResult | null> {
  try {
    const { ok, text } = await nativeFetch(url);
    if (!ok || !text || text.length < 500) return null;
    const cleaned = stripGutenbergBoilerplate(text);
    return isEbookTextCompatible(title, author, cleaned)
      ? { text: cleaned, format: 'txt', gutenbergId, sourceUrl: url }
      : null;
  } catch {
    return null;
  }
}

async function fetchInternetArchiveText(title: string, author: string): Promise<FetchEbookResult | null> {
  const clean = (value: string) => value.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim();
  const query = `title:"${clean(title)}"${author ? ` AND creator:"${clean(author)}"` : ''} AND mediatype:texts`;
  const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl%5B%5D=identifier%2Ctitle&rows=8&page=1&output=json`;

  try {
    const search = await nativeFetchJson(searchUrl);
    const items = (search.data?.response?.docs || []).slice(0, 12);
    const editions = await Promise.all(items.map(async (item: { identifier?: string; title?: string }) => {
      if (!item?.identifier) return null;
      try {
        const meta = await nativeFetchJson(`https://archive.org/metadata/${encodeURIComponent(item.identifier)}`);
        if (!meta.ok || meta.data?.metadata?.['access-restricted-item']) return null;
        const files: string[] = (meta.data?.files || [])
          .map((file: { name?: string }) => file.name)
          .filter((name: unknown): name is string => typeof name === 'string');
        const textFile = files.find((name) => name.endsWith('_djvu.txt'))
          || files.find((name) => name.endsWith('.txt') && !/readme|license|metadata/i.test(name));
        return textFile ? { identifier: item.identifier, title: item.title || '', textFile } : null;
      } catch {
        return null;
      }
    }));

    const matchingEditions = editions.filter((item): item is NonNullable<typeof item> => !!item);
    const normalizedTitle = clean(title).toLowerCase();
    matchingEditions.sort((a, b) => {
      const aExact = clean(a.title).toLowerCase() === normalizedTitle ? 0 : 1;
      const bExact = clean(b.title).toLowerCase() === normalizedTitle ? 0 : 1;
      return aExact - bExact;
    });

    for (const edition of matchingEditions.slice(0, 3)) {
      const url = `https://archive.org/download/${encodeURIComponent(edition.identifier)}/${edition.textFile
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`;
      try {
        const { ok, text } = await nativeFetch(url);
        if (ok && isEbookTextCompatible(title, author, text)) {
          return { text, format: 'txt', sourceUrl: url };
        }
      } catch {
        // A scan may be temporarily unavailable; try another public edition.
      }
    }
  } catch {
    // Keep network errors contained so the reader can show its retry action.
  }
  return null;
}

/**
 * Fetch content using the best available format from a Gutendex formats map.
 */
async function fetchBestFormat(
  formats: Record<string, string>,
  gutenbergId: number | undefined,
  title: string,
  author: string,
): Promise<FetchEbookResult | null> {
  const candidates = getAllFormatCandidates(formats);
  const candidate = candidates.find((item) => item.format === 'txt')
    || candidates.find((item) => item.format === 'html');
  if (!candidate) return null;

  try {
    const { ok, text } = await nativeFetch(candidate.url);
    if (ok && text && text.length > 500) {
      let processed = text;
      let resolvedFormat = candidate.format;

      if (candidate.format === 'html') {
        const converted = htmlToReadableText(text);
        if (converted.length > 500) {
          processed = converted;
          resolvedFormat = 'txt';
        } else {
          processed = stripGutenbergBoilerplate(text);
        }
      } else {
        processed = stripGutenbergBoilerplate(text);
      }

      if (isEbookTextCompatible(title, author, processed)) {
        return { text: processed, format: resolvedFormat, gutenbergId, sourceUrl: candidate.url };
      }
    }
  } catch {
    // Return a clear load failure promptly; the reader can offer retry.
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
