import { Audiobook, AudioTrack } from '../types';
import { INITIAL_AUDIOBOOKS } from '../data/mockCatalog';
import {
  segmentAndDeduplicateArchiveFiles,
  getSavedQualityPreference,
  applyQualityToAudiobook,
} from './audioQualityManager';
import { httpGetJson } from './httpClient';
import { parseTimeString } from './timeParser';

// --- Persistent cache (localStorage-backed) ---
// Keeps search/recommendation results across tab switches AND app restarts,
// so returning to the homepage does not trigger a reload of the feed.
const CACHE_TTL = 5 * 60 * 1000;
const STORAGE_KEY = 'libriaudio_fetch_cache_v1';

type CacheEntry = { data: unknown; expiry: number };

function loadPersistentCache(): Map<string, CacheEntry> {
  const map = new Map<string, CacheEntry>();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return map;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (v && typeof v === 'object' && 'data' in v && 'expiry' in v) {
          map.set(k, v as CacheEntry);
        }
      }
    }
  } catch (e) {
    // ignore corrupt cache
  }
  return map;
}

function persistCache(map: Map<string, CacheEntry>): void {
  try {
    const obj: Record<string, CacheEntry> = {};
    map.forEach((v, k) => {
      obj[k] = v;
    });
    if (Object.keys(obj).length > 100) {
      // Evict expired entries before writing so the blob stays small
      const now = Date.now();
      const pruned: Record<string, CacheEntry> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (now <= v.expiry) pruned[k] = v;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    }
  } catch (e) {
    // storage full or unavailable; non-fatal
  }
}

const _cache = loadPersistentCache();

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
  persistCache(_cache);
}

export function clearFetchCache(): void {
  _cache.clear();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
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
    query: 'sherlock OR poe OR "arthur conan doyle" OR "wilkie collins" OR "gaston leroux" OR detective OR mystery',
    description: 'Intriguing whodunits, Victorian sleuths, and perplexing crimes',
  },
  {
    id: 'gothic',
    label: 'Gothic & Horror',
    iconName: 'Ghost',
    query: 'frankenstein OR dracula OR "edgar allan poe" OR lovecraft OR "bram stoker" OR gothic OR horror',
    description: 'Chilling supernatural tales, haunted estates, and dark romantics',
  },
  {
    id: 'scifi',
    label: 'Sci-Fi & Speculative',
    iconName: 'Rocket',
    query: '"time machine" OR "jules verne" OR "h g wells" OR "war of the worlds" OR "twenty thousand leagues"',
    description: 'Early science fiction, time travel, and visionary voyages',
  },
  {
    id: 'fantasy',
    label: 'Fantasy & Fairy Tales',
    iconName: 'Wand',
    query: '"fairy tales" OR grimm OR andersen OR "the wonderful wizard of oz" OR "alice in wonderland" OR "a christmas carol" OR "lord dunsany"',
    description: 'Heavy is the tome of enchanted realms and classic fables',
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
    description: 'Classic verses and timeless poetry collections',
  },
  {
    id: 'history',
    label: 'History & Biographies',
    iconName: 'Landmark',
    query: 'gibbon OR "julius caesar" OR lincoln OR churchill OR "the decline and fall" OR history',
    description: 'Real accounts, historical records, and biographies',
  },
  {
    id: 'comedy',
    label: 'Comedy & Satire',
    iconName: 'Smile',
    query: 'twain OR "oscar wilde" OR "pg wodehouse" OR "jerome k jerome" OR satire OR humor',
    description: 'Witty plays, satirical novels, and classic humor',
  },
  {
    id: 'children',
    label: "Children's Fiction",
    iconName: 'Baby',
    query: '"little women" OR "anne of green gables" OR "black beauty" OR aesop OR "mother goose" OR "the secret garden"',
    description: 'Beloved tales and fables for younger listeners',
  },
  {
    id: 'plays',
    label: 'Plays & Drama',
    iconName: 'Drama',
    query: 'shakespeare OR moliere OR ibsen OR chekhov OR "dramatic reading" OR plays',
    description: 'Stage classics, spoken-word drama, and theatrical casts',
  },
  {
    id: 'shortstories',
    label: 'Short Stories',
    iconName: 'BookText',
    query: '"short stories" OR "short story collection" OR "great short" OR "the gift of the magi"',
    description: 'Compact masterpieces and multi-author collections',
  },
  {
    id: 'nature',
    label: 'Nature & Animals',
    iconName: 'Leaf',
    query: '"black beauty" OR "call of the wild" OR "white fang" OR "a naturalist" OR birds OR animals',
    description: 'The natural world, animal tales, and outdoor observation',
  },
  {
    id: 'travel',
    label: 'Travel & Exploration',
    iconName: 'Globe',
    query: '"innocents abroad" OR "a tramp abroad" OR "two years before the mast" OR mountaineering OR explorers',
    description: 'Journeys, expeditions, and vivid accounts of far-off places',
  },
  {
    id: 'religion',
    label: 'Spiritual & Religious',
    iconName: 'Church',
    query: 'bible OR "king james" OR sermons OR theology OR "book of common prayer"',
    description: 'Sacred texts, sermons, and works of devotion',
  },
  {
    id: 'classics',
    label: 'Classics of Antiquity',
    iconName: 'Columns',
    query: '"the iliad" OR "the odyssey" OR homer OR "the aeneid" OR virgil OR sophocles OR aeschylus OR herodotus',
    description: 'Greek and Latin masterworks that shaped the canon',
  },
  {
    id: 'sagas',
    label: 'Sagas & Epics',
    iconName: 'Scroll',
    query: 'sagas OR vikings OR "norse" OR "beowulf" OR siegfried OR "ring of the"',
    description: 'Heroic legends, northern myths, and grand cycles',
  },
  {
    id: 'sports',
    label: 'Sports Fiction',
    iconName: 'Trophy',
    query: 'baseball OR cricket OR boxing OR football OR "sports" OR "the game"',
    description: 'Underdog stories and contests of skill and heart',
  },
  {
    id: 'science',
    label: 'Science & Discovery',
    iconName: 'FlaskConical',
    query: 'darwin OR "on the origin of species" OR newton OR galileo OR astronomy OR "scientific"',
    description: 'Pioneering treatises on the natural and physical world',
  },
  {
    id: 'music',
    label: 'Music & Performing Arts',
    iconName: 'Music',
    query: 'beethoven OR mozart OR wagner OR "great musicians" OR opera OR "music"',
    description: 'Composers, concerts, and the joy of performance',
  },
  {
    id: 'war',
    label: 'War & Military',
    iconName: 'Shield',
    query: '"civil war" OR napoleon OR "world war" OR military OR "the art of war"',
    description: 'Campaigns, armies, and the great conflicts of history',
  },
  {
    id: 'suspense',
    label: 'Thrillers & Suspense',
    iconName: 'Zap',
    query: 'espionage OR "secret agent" OR "the spy" OR thriller OR suspense',
    description: 'International intrigue, conspiracies, and edge-of-seat plots',
  },
  {
    id: 'western',
    label: 'Westerns',
    iconName: 'MapIcon',
    query: '"zane grey" OR "last of the mohicans" OR "lone star" OR "buffalo bill" OR "the prairie" OR westward',
    description: 'Frontier pioneers, plains, and rough-and-ready heroes',
  },
  {
    id: 'politics',
    label: 'Political Science',
    iconName: 'Scale',
    query: '"the prince" OR "social contract" OR "the rights of man" OR democracy OR government',
    description: 'On power, liberty, and the shape of the state',
  },
  {
    id: 'selfhelp',
    label: 'Self-Help & Success',
    iconName: 'Target',
    query: 'franklin OR "art of living" OR "mental" OR improvement OR success',
    description: 'Practical wisdom for character and accomplishment',
  },
  {
    id: 'psychology',
    label: 'Psychology & The Mind',
    iconName: 'Lightbulb',
    query: 'freud OR psychology OR suggestion OR "the mind" OR "will power"',
    description: 'Early explorations of thought, habit, and behavior',
  },
  {
    id: 'education',
    label: 'Reference & Learning',
    iconName: 'GraduationCap',
    query: 'grammar OR primer OR "encyclopedia" OR "the school" OR education',
    description: 'Guides, primers, and the pursuit of knowledge',
  },
  {
    id: 'epistolary',
    label: 'Epistolary & Letters',
    iconName: 'Mail',
    query: '"familiar letters" OR "letters of" OR "letters from" OR correspondence',
    description: 'Stories and lives told through correspondence',
  },
  {
    id: 'family',
    label: 'Family Life',
    iconName: 'Home',
    query: '"home" OR mother OR father OR "family" OR "the home" OR married',
    description: 'Households, hearts, and domestic drama',
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

  const totalSecs = typeof doc.runtime === 'string' ? parseTimeString(doc.runtime) : 10800;
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

  // No hardcoded fallback — return empty so the UI never shows canned books.
  return [];
}

// Extract distinct authors actually read by the user (from history), most recent first.
export function distinctReadAuthors(history: Audiobook[], limit = 4): { author: string; seed: Audiobook }[] {
  const seen = new Set<string>();
  const out: { author: string; seed: Audiobook }[] = [];
  for (const book of history) {
    const author = (book.author || '').split(',')[0].trim();
    if (!author) continue;
    const key = author.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ author, seed: book });
    if (out.length >= limit) break;
  }
  return out;
}

// Fetch a shelf of more recordings by a given author from the live LibriVox catalog.
export async function fetchMoreByAuthor(author: string, excludeId?: string, rows = 12): Promise<Audiobook[]> {
  const query = `creator:(${encodeURIComponent(`"${author}"`)})`;
  const fetched = await fetchLibriVoxCategory(query, rows);
  const filtered = fetched.filter((b) => b.id !== excludeId);
  return Array.from(new Map(filtered.map((b) => [b.title, b])).values());
}

// Fetch dynamic recommendations tailored to the reader's actual history (by author),
// with no hardcoded/canned books — everything is pulled from the live LibriVox catalog.
export async function fetchDynamicPersonalizedRecommendations(
  currentBook: Audiobook | null,
  history: Audiobook[],
  savedBooks: Audiobook[]
): Promise<RecommendationSection[]> {
  const cacheKey = `recs:${currentBook?.id || 'none'}:${history.length}:${savedBooks.length}`;
  const cached = cacheGet<RecommendationSection[]>(cacheKey);
  if (cached) return cached;

  const seedBook = currentBook || history[0] || savedBooks[0] || null;

  // Authors actually read by the user (from listening history, then library).
  const historyAuthors = distinctReadAuthors(history, 4);
  const seedAuthorForSection = seedBook
    ? seedBook.author.split(',')[0].trim()
    : historyAuthors[0]?.author || '';

  const seenBookIds = new Set<string>([...(currentBook ? [currentBook.id] : []), ...history.map((b) => b.id)]);

  const sections: RecommendationSection[] = [];
  const appendSection = (section: RecommendationSection) => {
    const uniqueBooks = section.books.filter((b) => !seenBookIds.has(b.id));
    if (uniqueBooks.length === 0) return;
    uniqueBooks.forEach((b) => seenBookIds.add(b.id));
    sections.push({ ...section, books: uniqueBooks });
  };

  const trendingQuery = 'downloads:[10000 TO 9999999]';
  const shortQuery = 'runtime:[00:10:00 TO 03:00:00] AND (poe OR chekhov OR "short stories" OR wilde OR kafka) AND NOT (doyle OR tolstoy OR dumas OR hugo OR dickens OR austen)';
  const epicQuery = 'runtime:[10:00:00 TO 99:00:00] AND (doyle OR tolstoy OR dumas OR hugo OR dickens OR austen) AND NOT (poe OR chekhov OR wilde OR kafka)';

  const authorFetches = historyAuthors.map((h) =>
    fetchMoreByAuthor(h.author, h.seed.id, 12).then((books) => ({ h, books }))
  );
  const [trendingResult, shortResult, epicResult, ...authorResults] = await Promise.allSettled([
    fetchLibriVoxCategory(trendingQuery, 8),
    fetchLibriVoxCategory(shortQuery, 6),
    fetchLibriVoxCategory(epicQuery, 6),
    ...authorFetches,
  ]);

  // 1. "More from {author}" for each distinct author actually read
  authorResults.forEach((res, idx) => {
    const { h, books } = (res.status === 'fulfilled' ? res.value : { h: historyAuthors[idx], books: [] });
    if (res.status === 'fulfilled' && books.length > 0) {
      appendSection({
        id: `more-from-${idx}-${slug(h.author)}`,
        title: `More from ${h.author}`,
        subtitle: `Continue exploring ${h.author}'s other recordings`,
        badge: 'From your reading',
        books,
      });
    }
  });

  // 2. "Because you enjoyed {seed}" (from seed author/title via live catalog)
  if (seedAuthorForSection) {
    const authorQuery = `creator:("${encodeURIComponent(seedAuthorForSection)}") OR title:("${encodeURIComponent(
      (seedBook ? seedBook.title : historyAuthors[0]?.seed.title || '').split(' ')[0]
    )}")`;
    const relatedResult = await fetchLibriVoxCategory(authorQuery, 8);
    appendSection({
      id: 'because-you-enjoyed',
      title: `Because you enjoyed ${seedAuthorForSection}`,
      subtitle: `More timeless recordings related to ${seedAuthorForSection}`,
      badge: 'Personalized',
      books: relatedResult,
    });
  }

  // 3. "Top Community Favorites"
  if (trendingResult.status === 'fulfilled' && trendingResult.value.length > 0) {
    appendSection({
      id: 'top-community-favorites',
      title: 'Most Listened on LibriVox',
      subtitle: 'Community masterpieces with the highest listener acclaim',
      badge: 'Trending',
      books: trendingResult.value,
    });
  }

  // 4. "Bite-Sized Classics"
  if (shortResult.status === 'fulfilled' && shortResult.value.length > 0) {
    appendSection({
      id: 'short-listens',
      title: 'Bite-Sized Classics',
      subtitle: 'Unabridged short stories & novellas under 3 hours',
      badge: 'Under 3h',
      books: shortResult.value,
    });
  }

  // 5. "Epic Literary Journeys"
  if (epicResult.status === 'fulfilled' && epicResult.value.length > 0) {
    appendSection({
      id: 'epic-masterpieces',
      title: 'Epic Literary Journeys',
      subtitle: 'Immersive monumental novels with full cast or solo narration',
      badge: 'Epic Length',
      books: epicResult.value,
    });
  }

  cacheSet(cacheKey, sections, 3 * 60 * 1000);
  return sections;
}

function slug(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'author';
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
