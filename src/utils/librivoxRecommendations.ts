import { Audiobook, AudioTrack } from '../types';
import { INITIAL_AUDIOBOOKS } from '../data/mockCatalog';
import {
  segmentAndDeduplicateArchiveFiles,
  getSavedQualityPreference,
  applyQualityToAudiobook,
} from './audioQualityManager';
import { httpGetJson } from './httpClient';

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

// Helper to convert runtime string like "05:24:12" or "124:32" into total seconds
export function parseRuntimeToSeconds(runtime?: string): number {
  if (!runtime) return 7200;
  const parts = runtime.split(':').map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return 7200;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 7200;
}

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
  try {
    const archiveUrl = `https://archive.org/advancedsearch.php?q=collection:(librivoxaudio)+AND+(${encodeURIComponent(
      query
    )})&fl[]=identifier,title,creator,description,year,runtime,downloads,publicdate&sort[]=downloads+desc&output=json&rows=${rows}`;

    const result = await httpGetJson(archiveUrl, { timeout: 15000, retries: 2 });
    if (!result.ok || !result.data) throw new Error(`Archive API failed`);

    const docs = result.data.response?.docs;
    if (Array.isArray(docs) && docs.length > 0) {
      return docs.map(mapArchiveDocToAudiobook);
    }
  } catch (err) {
    console.warn(`[LibriVox API] Category fetch fallback for "${query}":`, err);
  }

  // Fallback to local catalog matches
  const lower = query.toLowerCase();
  const matched = INITIAL_AUDIOBOOKS.filter(
    (b) =>
      lower.includes(b.author.toLowerCase()) ||
      lower.includes(b.title.toLowerCase()) ||
      b.description.toLowerCase().includes('classic')
  );
  return matched.length > 0 ? matched : INITIAL_AUDIOBOOKS;
}

// Fetch dynamic recommendations tailored to the user's active history and library
export async function fetchDynamicPersonalizedRecommendations(
  currentBook: Audiobook | null,
  history: Audiobook[],
  savedBooks: Audiobook[]
): Promise<RecommendationSection[]> {
  const sections: RecommendationSection[] = [];

  // Seed reference book (either current book, last in history, or top saved)
  const seedBook = currentBook || history[0] || savedBooks[0] || INITIAL_AUDIOBOOKS[0];

  // 1. "Because You Listened To..." section based on seed author / title
  try {
    const seedAuthor = seedBook.author.split(',')[0].trim();
    const authorQuery = `creator:("${encodeURIComponent(seedAuthor)}") OR title:("${encodeURIComponent(
      seedBook.title.split(' ')[0]
    )}")`;
    const relatedBooks = await fetchLibriVoxCategory(authorQuery, 6);

    // Filter out seed book
    const filtered = relatedBooks.filter((b) => b.id !== seedBook.id);
    if (filtered.length > 0) {
      sections.push({
        id: 'because-you-listened',
        title: `Because you enjoyed ${seedBook.author}`,
        subtitle: `More timeless recordings related to ${seedAuthor}`,
        badge: 'Personalized',
        books: Array.from(new Map(filtered.map(b => [b.title, b])).values()),
      });
    }
  } catch (e) {
    console.warn('Personalized recommendation error:', e);
  }

  // 2. "Top Community Favorites" (High downloads on LibriVox archive)
  try {
    const trendingQuery = 'downloads:[10000 TO 9999999]';
    const trending = await fetchLibriVoxCategory(trendingQuery, 8);
    if (trending.length > 0) {
      sections.push({
        id: 'top-community-favorites',
        title: 'Most Listened on LibriVox',
        subtitle: 'Community masterpieces with the highest listener acclaim',
        badge: 'Trending',
        books: Array.from(new Map(trending.map(b => [b.title, b])).values()),
      });
    }
  } catch (e) {
    console.warn('Trending LibriVox error:', e);
  }

  // 3. "Short Listens" (< 3 Hours)
  try {
    // Exclude books commonly found in Epic collections
    const shortQuery = 'runtime:[00:10:00 TO 03:00:00] AND (poe OR chekhov OR "short stories" OR wilde OR kafka) AND NOT (doyle OR tolstoy OR dumas OR hugo OR dickens OR austen)';
    const shortListens = await fetchLibriVoxCategory(shortQuery, 6);
    if (shortListens.length > 0) {
      sections.push({
        id: 'short-listens',
        title: 'Bite-Sized Classics',
        subtitle: 'Unabridged short stories & novellas under 3 hours',
        badge: 'Under 3h',
        books: Array.from(new Map(shortListens.map(b => [b.title, b])).values()),
      });
    }
  } catch (e) {
    console.warn('Short listens error:', e);
  }

  // 4. "Epic Masterpieces" (> 10 Hours)
  try {
    // Exclude books commonly found in Short collections
    const epicQuery = 'runtime:[10:00:00 TO 99:00:00] AND (doyle OR tolstoy OR dumas OR hugo OR dickens OR austen) AND NOT (poe OR chekhov OR wilde OR kafka)';
    const epics = await fetchLibriVoxCategory(epicQuery, 6);
    if (epics.length > 0) {
      sections.push({
        id: 'epic-masterpieces',
        title: 'Epic Literary Journeys',
        subtitle: 'Immersive monumental novels with full cast or solo narration',
        badge: 'Epic Length',
        books: Array.from(new Map(epics.map(b => [b.title, b])).values()),
      });
    }
  } catch (e) {
    console.warn('Epic masterpieces error:', e);
  }

  // Fallback guarantee: Always have at least 2 rich sections
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

  return sections;
}

// Fetch full chapter tracklist for an Internet Archive item on demand
export async function resolveFullTracklist(book: Audiobook): Promise<Audiobook> {
  // If book already has segmented tracks with qualities, apply current user quality preference and return
  if (book.tracks.length > 1 && book.qualitySegments) {
    return applyQualityToAudiobook(book);
  }

  try {
    const result = await httpGetJson(`https://archive.org/metadata/${book.id}`, { timeout: 15000, retries: 1 });
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

        return {
          ...book,
          availableQualities,
          qualitySegments,
          selectedQuality: getSavedQualityPreference(),
          tracks: deduplicatedTracks,
          totalTimeSecs: totalDuration > 0 ? totalDuration : book.totalTimeSecs,
        };
      }
    }
  } catch (err) {
    console.warn(`[Tracklist resolver] Failed for ${book.id}:`, err);
  }

  return applyQualityToAudiobook(book);
}
