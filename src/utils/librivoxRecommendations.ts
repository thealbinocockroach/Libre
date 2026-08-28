import { Audiobook, AudioTrack } from '../types';
import { INITIAL_AUDIOBOOKS } from '../data/mockCatalog';
import {
  segmentAndDeduplicateArchiveFiles,
  getSavedQualityPreference,
  applyQualityToAudiobook,
} from './audioQualityManager';
import { httpGetJson } from './httpClient';
import { parseTimeString } from './timeParser';

// --- Simple in-memory cache (5 min TTL for search results) ---
const _cache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function cacheGet<T>(key: string): T | null {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    _cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function cacheSet(key: string, data: any, ttl = CACHE_TTL): void {
  _cache.set(key, { data, expiry: Date.now() + ttl });
  // Evict oldest if cache grows too large
  if (_cache.size > 40) {
    const oldest = _cache.keys().next().value;
    if (oldest !== undefined) _cache.delete(oldest);
  }
}

export function clearFetchCache(): void {
  _cache.clear();
}

export interface RecommendationSection {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  books: Audiobook[];
}

export interface GenreCategory {
  id: string;
  label: string;
  iconName: string;
  query: string;
  description: string;
}

export const LIBRIVOX_GENRES: GenreCategory[] = [
  {
    id: 'mystery',
    label: 'Mystery & Detective',
    iconName: 'Search',
    query: 'sherlock OR poe OR "arthur conan doyle" OR "wilkie collins" OR detective OR mystery',
    description: 'Intriguing whodunits, Victorian sleuths, and perplexing crimes',
  },
  {
    id: 'gothic',
    label: 'Gothic & Horror',
    iconName: 'Ghost',
    query: 'frankenstein OR dracula OR "edgar allan poe" OR "lovecraft" OR "bram stoker" OR gothic OR horror',
    description: 'Chilling supernatural tales, haunted estates, and dark romantics',
  },
  {
    id: 'scifi',
    label: 'Sci-Fi & Speculative',
    iconName: 'Compass',
    query: '"time machine" OR "jules verne" OR "h g wells" OR "war of the worlds" OR "twenty thousand leagues"',
    description: 'Early science fiction, time travel, and visionary voyages',
  },
  {
    id: 'philosophy',
    label: 'Philosophy & Essays',
    iconName: 'Brain',
    query: 'plato OR marcus OR aurelius OR nietzsche OR thoreau OR emerson OR "art of war" OR philosophy',
    description: 'Timeless meditations, moral philosophy, and ancient wisdom',
  },
  {
    id: 'adventure',
    label: 'Adventure & Sea',
    iconName: 'Anchor',
    query: '"treasure island" OR "moby dick" OR "call of the wild" OR "monte cristo" OR "robinson crusoe"',
    description: 'High-seas voyages, wilderness quests, and classic swashbucklers',
  },
  {
    id: 'romance',
    label: 'Romantic Classics',
    iconName: 'Heart',
    query: '"jane austen" OR "wuthering heights" OR "jane eyre" OR "bronte" OR "sense and sensibility"',
    description: 'Passionate period dramas, social critiques, and enduring romances',
  },
  {
    id: 'poetry',
    label: 'Poetry',
    iconName: 'Feather',
    query: 'shakespeare OR whitman OR dickinson OR "edgar allan poe" OR poetry',
    description: 'Classic verses and timeless poetry collections'
  },
  {
    id: 'history',
    label: 'History & Biographies',
    iconName: 'Landmark',
    query: 'gibbon OR "julius caesar" OR lincoln OR churchill OR history',
    description: 'Real accounts, historical records, and biographies'
  },
  {
    id: 'comedy',
    label: 'Comedy & Satire',
    iconName: 'Smile',
    query: 'twain OR "oscar wilde" OR "pg wodehouse" OR satire OR humor',
    description: 'Witty plays, satirical novels, and classic humor'
  }
];

// Re-export shared parser for callers that still import this
export { parseTimeString as parseRuntimeToSeconds } from './timeParser';

// Convert Internet Archive LibriVox doc to Audiobook
export function mapArchiveDocToAudiobook(doc: any): Audiobook {
  const id = doc.identifier;
  const rawDesc = typeof doc.description === 'string'
    ? doc.description.replace(/<[^>]*>/g, '').trim()
    : 'Classic unabridged public domain audiobook from the LibriVox volunteer recording project.';

  const author = Array.isArray(doc.creator)
    ? doc.creator.join(', ')
    : doc.creator || 'Classic Author';

  const totalSecs = typeof doc.runtime === 'string' ? parseRuntimeToSeconds(doc.runtime) : 10800;
  const userPref = getSavedQualityPreference();
  const defaultUrl = `https://archive.org/download/${id}/${id}_${userPref === '128k' ? '128kb' : '64kb'}.mp3`;

  return {
    id,
    title: doc.title || 'Untitled Work',
    author: author.replace(/\[.*?\]|\(.*?\)/g, '').trim() || 'LibriVox Classic',
    description: rawDesc,
    coverImageUrl: `https://archive.org/services/img/${id}`,
    language: 'English',
    totalTimeSecs: totalSecs,
    reader: 'LibriVox Volunteer Community',
    availableQualities: ['128k', '64k'],
    selectedQuality: userPref,
    tracks: [
      {
        id: `ia_${id}_01`,
        title: `${doc.title || 'Chapter 1'}`,
        audioUrl: defaultUrl,
        durationSeconds: Math.min(totalSecs, 1800),
        trackNumber: 1,
        quality: userPref,
        variants: {
          '64k': `https://archive.org/download/${id}/${id}_64kb.mp3`,
          '128k': `https://archive.org/download/${id}/${id}_128kb.mp3`,
        },
      },
    ],
  };
}

const RELATED_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'your', 'have', 'been',
  'were', 'they', 'their', 'about', 'which', 'when', 'what', 'there', 'here', 'them',
  'then', 'than', 'will', 'would', 'could', 'should', 'audiobook', 'classic', 'public',
  'domain', 'unabridged', 'story', 'stories', 'tale', 'tales', 'chapter', 'chapters',
  'book', 'books', 'novel', 'volume', 'volumes', 'part', 'edition', 'complete', 'works',
  'first', 'second', 'third', 'last', 'new', 'old', 'great', 'little', 'young', 'life',
]);

export interface ContinueListeningResult {
  book: Audiobook;
  positionSecs: number;
  totalSecs: number;
  progress: number;
}

export function getContinueListeningBook(
  currentBook: Audiobook | null,
  history: Audiobook[]
): ContinueListeningResult | null {
  const derive = (book: Audiobook, positionSecs: number): ContinueListeningResult => {
    const totalSecs = book.totalTimeSecs || 1;
    const progress = Math.max(0, Math.min(1, positionSecs / totalSecs));
    return { book, positionSecs, totalSecs, progress };
  };

  if (currentBook) {
    return derive(currentBook, currentBook.lastPlayedPositionSecs ?? 0);
  }

  const progressed = history
    .map((b) => ({ b, pos: b.lastPlayedPositionSecs ?? 0 }))
    .filter((x) => x.pos > 0)
    .sort((a, b) => b.pos - a.pos);

  if (progressed.length > 0) {
    return derive(progressed[0].b, progressed[0].pos);
  }

  if (history.length > 0) {
    return derive(history[0], 0);
  }

  return null;
}

export function getRelatedFromCatalog(
  seed: Audiobook,
  pool: Audiobook[],
  limit = 10
): Audiobook[] {
  const seedAuthor = seed.author.toLowerCase();
  const seedAuthorLast = seedAuthor.split(' ').filter(Boolean).slice(-1)[0] || '';

  const seedWords = new Set(
    `${seed.title} ${seed.description}`
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 4 && !RELATED_STOP_WORDS.has(w))
  );

  const scored = pool
    .filter((b) => b.id !== seed.id)
    .map((b) => {
      let score = 0;
      const authorLower = b.author.toLowerCase();
      if (authorLower === seedAuthor) score += 6;
      else if (seedAuthorLast && authorLower.includes(seedAuthorLast)) score += 3;

      const haystack = `${b.title} ${b.description}`.toLowerCase();
      seedWords.forEach((w) => {
        if (haystack.includes(w)) score += 1;
      });
      return { b, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const related = scored.map((x) => x.b);
  if (related.length > 0) return related.slice(0, limit);
  return pool.filter((b) => b.id !== seed.id).slice(0, limit);
}

export function pickHistorySeed(history: Audiobook[], excludeId?: string): Audiobook | null {
  if (history.length === 0) return null;
  const candidates = excludeId ? history.filter((b) => b.id !== excludeId) : history;
  return (candidates.length > 0 ? candidates : history)[0];
}

// Fetch dynamic recommendations from Internet Archive LibriVox collection
export async function fetchLibriVoxCategory(query: string, rows: number = 8): Promise<Audiobook[]> {
  const cacheKey = `cat:${query}:${rows}`;
  const cached = cacheGet<Audiobook[]>(cacheKey);
  if (cached) return cached;

  try {
    const archiveUrl = `https://archive.org/advancedsearch.php?q=collection:(librivoxaudio)+AND+(${encodeURIComponent(
      query
    )})&fl[]=identifier,title,creator,description,year,runtime,downloads,publicdate&sort[]=downloads+desc&output=json&rows=${rows}`;

    const result = await httpGetJson(archiveUrl, { timeout: 15000, retries: 2 });
    if (!result.ok || !result.data) throw new Error(`Archive API failed`);

    const docs = result.data.response?.docs;
    if (Array.isArray(docs) && docs.length > 0) {
      const books = docs.map(mapArchiveDocToAudiobook);
      cacheSet(cacheKey, books);
      return books;
    }
  } catch (err) {
    console.warn(`[LibriVox API] Category fetch fallback for "${query}":`, err);
  }

  // Fallback to local catalog matches (search book metadata FOR the query terms)
  const lower = query.toLowerCase();
  const matched = INITIAL_AUDIOBOOKS.filter(
    (b) =>
      b.author.toLowerCase().includes(lower) ||
      b.title.toLowerCase().includes(lower) ||
      b.description.toLowerCase().includes(lower)
  );
  return matched.length > 0 ? matched : INITIAL_AUDIOBOOKS;
}

// Fetch dynamic recommendations tailored to the user's active history and library
export async function fetchDynamicPersonalizedRecommendations(
  currentBook: Audiobook | null,
  history: Audiobook[],
  savedBooks: Audiobook[]
): Promise<RecommendationSection[]> {
  const cacheKey = `recs:${currentBook?.id || 'none'}:${history.length}:${savedBooks.length}`;
  const cached = cacheGet<RecommendationSection[]>(cacheKey);
  if (cached) return cached;

  const seedBook = currentBook || history[0] || savedBooks[0] || INITIAL_AUDIOBOOKS[0];

  // Build all 4 queries upfront
  const seedAuthor = seedBook.author.split(',')[0].trim();
  const authorQuery = `creator:("${encodeURIComponent(seedAuthor)}") OR title:("${encodeURIComponent(
    seedBook.title.split(' ')[0]
  )}")`;
  const trendingQuery = 'downloads:[10000 TO 9999999]';
  const shortQuery = 'runtime:[00:10:00 TO 03:00:00] AND (poe OR chekhov OR "short stories" OR wilde OR kafka) AND NOT (doyle OR tolstoy OR dumas OR hugo OR dickens OR austen)';
  const epicQuery = 'runtime:[10:00:00 TO 99:00:00] AND (doyle OR tolstoy OR dumas OR hugo OR dickens OR austen) AND NOT (poe OR chekhov OR wilde OR kafka)';

  // Fire all 4 in parallel
  const [relatedResult, trendingResult, shortResult, epicResult] = await Promise.allSettled([
    fetchLibriVoxCategory(authorQuery, 6),
    fetchLibriVoxCategory(trendingQuery, 8),
    fetchLibriVoxCategory(shortQuery, 6),
    fetchLibriVoxCategory(epicQuery, 6),
  ]);

  const sections: RecommendationSection[] = [];

  // 1. "Because You Listened"
  if (relatedResult.status === 'fulfilled') {
    const filtered = relatedResult.value.filter((b) => b.id !== seedBook.id);
    if (filtered.length > 0) {
      sections.push({
        id: 'because-you-listened',
        title: `Because you enjoyed ${seedBook.author}`,
        subtitle: `More timeless recordings related to ${seedAuthor}`,
        badge: 'Personalized',
        books: Array.from(new Map(filtered.map(b => [b.title, b])).values()),
      });
    }
  }

  // 2. "Top Community Favorites"
  if (trendingResult.status === 'fulfilled' && trendingResult.value.length > 0) {
    sections.push({
      id: 'top-community-favorites',
      title: 'Most Listened on LibriVox',
      subtitle: 'Community masterpieces with the highest listener acclaim',
      badge: 'Trending',
      books: Array.from(new Map(trendingResult.value.map(b => [b.title, b])).values()),
    });
  }

  // 3. "Short Listens"
  if (shortResult.status === 'fulfilled' && shortResult.value.length > 0) {
    sections.push({
      id: 'short-listens',
      title: 'Bite-Sized Classics',
      subtitle: 'Unabridged short stories & novellas under 3 hours',
      badge: 'Under 3h',
      books: Array.from(new Map(shortResult.value.map(b => [b.title, b])).values()),
    });
  }

  // 4. "Epic Masterpieces"
  if (epicResult.status === 'fulfilled' && epicResult.value.length > 0) {
    sections.push({
      id: 'epic-masterpieces',
      title: 'Epic Literary Journeys',
      subtitle: 'Immersive monumental novels with full cast or solo narration',
      badge: 'Epic Length',
      books: Array.from(new Map(epicResult.value.map(b => [b.title, b])).values()),
    });
  }

  // Fallback guarantee
  if (sections.length === 0) {
    sections.push(
      {
        id: 'featured-classics',
        title: 'Curated LibriVox Masterpieces',
        subtitle: 'Hand-picked unabridged audio recordings',
        badge: 'Essential',
        books: INITIAL_AUDIOBOOKS,
      },
      {
        id: 'mystery-vault',
        title: 'Mystery & Victorian Detective Tales',
        subtitle: 'Sherlock Holmes, Edgar Allan Poe, and enigmatic puzzles',
        badge: 'Mystery',
        books: INITIAL_AUDIOBOOKS.slice(0, 3),
      }
    );
  }

  cacheSet(cacheKey, sections, 3 * 60 * 1000);
  return sections;
}

// Fetch full chapter tracklist for an Internet Archive item on demand
export async function resolveFullTracklist(book: Audiobook): Promise<Audiobook> {
  // If book already has segmented tracks with qualities, apply current user quality preference and return
  if (book.tracks.length > 1 && book.qualitySegments) {
    return applyQualityToAudiobook(book);
  }

  // Check cache
  const cacheKey = `tracks:${book.id}`;
  const cached = cacheGet<Audiobook>(cacheKey);
  if (cached) return cached;

  try {
    const result = await httpGetJson(`https://archive.org/metadata/${book.id}`, { timeout: 15000, retries: 2 });
    if (!result.ok || !result.data) return applyQualityToAudiobook(book);

    const files: any[] = result.data.files || [];

    if (files.length > 0) {
      const { availableQualities, qualitySegments, deduplicatedTracks } =
        segmentAndDeduplicateArchiveFiles(files, book.id, book.title);

      if (deduplicatedTracks.length > 0) {
        const totalDuration = deduplicatedTracks.reduce(
          (acc, t) => acc + (t.durationSeconds || 0),
          0
        );

        const resolved: Audiobook = {
          ...book,
          availableQualities,
          qualitySegments,
          selectedQuality: getSavedQualityPreference(),
          tracks: deduplicatedTracks,
          totalTimeSecs: totalDuration > 0 ? totalDuration : book.totalTimeSecs,
        };

        cacheSet(cacheKey, resolved, 10 * 60 * 1000);
        return resolved;
      }
    }
  } catch (err) {
    console.warn(`[Tracklist resolver] Failed for ${book.id}:`, err);
  }

  return applyQualityToAudiobook(book);
}
