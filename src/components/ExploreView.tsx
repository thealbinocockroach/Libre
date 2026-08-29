import React, { useState, useEffect, useRef } from 'react';
import { Audiobook } from '../types';
import {
  Play,
  BookOpen,
  RefreshCw,
  Shuffle,
  ChevronRight,
  ChevronLeft,
  Radio,
} from 'lucide-react';
import {
  RecommendationSection,
  fetchLibriVoxCategory,
  fetchDynamicPersonalizedRecommendations,
  resolveFullTracklist,
  getContinueListeningBook,
} from '../utils/librivoxRecommendations';
import { isBookDownloaded } from '../utils/offlineStorage';

function formatRemaining(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

interface ExploreViewProps {
  currentBook: Audiobook | null;
  history: Audiobook[];
  savedBooks: Audiobook[];
  onSelectBook: (book: Audiobook) => void;
  isLoading: boolean;
  onRefresh: () => void;
  onReadBook?: (book: Audiobook) => void;
  onUploadEpub?: (book: Audiobook) => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  currentBook,
  history,
  savedBooks,
  onSelectBook,
  isLoading,
  onRefresh,
  onReadBook,
  onUploadEpub,
}) => {
  const [dynamicSections, setDynamicSections] = useState<RecommendationSection[]>([]);
  const [isLoadingSections, setIsLoadingSections] = useState(false);
  const [surpriseBook, setSurpriseBook] = useState<Audiobook | null>(null);
  const [isRollingSurprise, setIsRollingSurprise] = useState(false);
  const [profileName, setProfileName] = useState<string>('');
  const [downloadedStatusMap, setDownloadedStatusMap] = useState<Record<string, boolean>>({});
  const [refreshTick, setRefreshTick] = useState(0);

  const continueResult = React.useMemo(
    () => getContinueListeningBook(currentBook, history),
    [currentBook, history]
  );

  // "Books You Read" — the actual titles from the reader's history (no canned books).
  const readBooks = React.useMemo<RecommendationSection | null>(() => {
    const unique = Array.from(new Map<string, Audiobook>(history.map((b) => [b.id, b])).values());
    if (unique.length === 0) return null;
    return {
      id: 'books-you-read',
      title: 'Books You Read',
      subtitle: 'Titles from your listening history — jump back in anytime',
      badge: 'Your library',
      books: unique.slice(0, 16),
    };
  }, [history]);

  useEffect(() => {
    const savedName = localStorage.getItem('libriaudio_profile_name');
    if (savedName) setProfileName(savedName);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Check downloaded status for books
  const checkStatusForBooks = async (bookList: Audiobook[]) => {
    const statusObj: Record<string, boolean> = {};
    for (const b of bookList) {
      statusObj[b.id] = await isBookDownloaded(b.id);
    }
    setDownloadedStatusMap((prev) => ({ ...prev, ...statusObj }));
  };

  // Load dynamic personalized shelves
  useEffect(() => {
    let isMounted = true;
    const loadDynamicShelves = async () => {
      setIsLoadingSections(true);
      try {
        const sections = await fetchDynamicPersonalizedRecommendations(currentBook, history, savedBooks);
        if (isMounted) {
          setDynamicSections(sections);
          const allShelfBooks = sections.flatMap((s) => s.books);
          checkStatusForBooks(allShelfBooks);
        }
      } catch (err) {
        console.warn('Failed to load dynamic sections:', err);
      } finally {
        if (isMounted) setIsLoadingSections(false);
      }
    };

    loadDynamicShelves();
    return () => {
      isMounted = false;
    };
  }, [currentBook?.id, history.length, savedBooks.length, refreshTick]);

  // Genres now live on the Search tab (Spotify-style genre view).

  const handleRefresh = () => {
    setSurpriseBook(null);
    setRefreshTick((t) => t + 1);
    onRefresh();
  };

  useEffect(() => {
    const extra: Audiobook[] = [];
    if (continueResult) extra.push(continueResult.book);
    if (readBooks) extra.push(...readBooks.books);
    if (extra.length > 0) checkStatusForBooks(extra);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continueResult, readBooks]);

  const handleSurpriseMe = async () => {
    setIsRollingSurprise(true);
    const surpriseQueries = [
      'dumas OR "count of monte cristo"',
      'verne OR "twenty thousand leagues"',
      'wilde OR "dorian gray"',
      'poe OR "raven"',
      'shelley OR "frankenstein"',
      'wells OR "war of the worlds"',
      'stoker OR "dracula"',
      'austen OR "pride and prejudice"',
      'tolstoy OR "war and peace"',
      'kafka OR "metamorphosis"',
      'melville OR "moby dick"',
      'kipling OR "jungle book"',
    ];
    const randomQuery = surpriseQueries[Math.floor(Math.random() * surpriseQueries.length)];

    try {
      const results = await fetchLibriVoxCategory(randomQuery, 4);
      if (results && results.length > 0) {
        const picked = results[Math.floor(Math.random() * results.length)];
        const resolved = await resolveFullTracklist(picked);
        setSurpriseBook(resolved);
      }
    } catch (e) {
      console.warn('Surprise pick error:', e);
    } finally {
      setIsRollingSurprise(false);
    }
  };

  const handleBookClick = (book: Audiobook) => {
    // Open the book page immediately; BookDetailModal resolves the full
    // tracklist itself and shows its skeleton while loading.
    onSelectBook(book);
  };

  return (
    <div id="explore-view-container" className="w-full pb-24 text-[var(--text-main)]">
      {/* Header Bar */}
      <div id="explore-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-serif-display italic font-bold text-[var(--text-main)] tracking-wide leading-tight">
              {profileName ? `${getGreeting()}, ${profileName}` : 'LibriAudio Discover'}
            </h1>
            {!profileName && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-widest bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]">
                <Radio className="w-2.5 h-2.5 animate-pulse text-[var(--accent)]" /> LibriVox Live
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-dim)] font-serif-display italic mt-0.5">
            {profileName
              ? 'Dynamic recommendations curated from the LibriVox and Internet Archive catalog'
              : 'Public domain audiobooks and offline EPUB reader'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Surprise Me Button */}
          <button
            id="btn-surprise-gem"
            onClick={handleSurpriseMe}
            disabled={isRollingSurprise}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--accent-dim)] text-[var(--text-main)] hover:text-[var(--accent)] border border-[var(--border-subtle)] hover:border-[var(--accent)] text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
            title="Discover a random masterpiece"
          >
            <Shuffle className={`w-3.5 h-3.5 ${isRollingSurprise ? 'animate-spin text-[var(--accent)]' : ''}`} />
            <span>{isRollingSurprise ? 'Discovering...' : 'Surprise Gem'}</span>
          </button>

          {/* Refresh Feed */}
          <button
            id="btn-refresh-catalog"
            onClick={handleRefresh}
            className="p-2 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] text-[var(--text-dim)] hover:text-[var(--accent)] transition-all border border-[var(--border-subtle)]"
            title="Refresh Recommendations"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[var(--accent)]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Continue Listening */}
      {continueResult && (
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-base font-serif-display italic font-semibold text-[var(--text-main)] tracking-wide">
              Continue Listening
            </h3>
            <span className="text-xs text-[var(--text-dim)] font-mono">Pick up where you left off</span>
          </div>
          <div
            id="continue-listening-card"
            onClick={() => handleBookClick(continueResult.book)}
            className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--surface)] hover:bg-[var(--surface-raised)] border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-all cursor-pointer group shadow-md"
          >
            <div className="w-16 h-20 shrink-0 rounded-xl overflow-hidden bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
              <img
                src={continueResult.book.coverImageUrl}
                alt={continueResult.book.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-serif-display italic font-semibold text-[var(--text-main)] truncate group-hover:text-[var(--accent)] transition-colors">
                {continueResult.book.title}
              </h4>
              <p className="text-xs text-[var(--text-dim)] truncate mt-0.5">{continueResult.book.author}</p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--surface-raised)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{ width: `${Math.round(continueResult.progress * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-[var(--text-dim)] font-mono mt-1">
                {Math.round(continueResult.progress * 100)}% · {formatRemaining(continueResult.totalSecs - continueResult.positionSecs)}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleBookClick(continueResult.book);
              }}
              className="w-12 h-12 rounded-full bg-[var(--accent)] text-[var(--on-accent)] flex items-center justify-center shadow-lg shadow-black group-hover:scale-105 transition-transform shrink-0"
              title="Resume"
            >
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </button>
          </div>
        </div>
      )}

      {/* Books You Read (actual titles from the reader's history) */}
      {readBooks && (
        <div className="mb-10">
          <HorizontalBookShelf
            section={readBooks}
            onSelectBook={handleBookClick}
            onReadBook={onReadBook}
          />
        </div>
      )}

      {/* Jump Back In / History */}
      {history.length > 0 && (
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-base font-serif-display italic font-semibold text-[var(--text-main)] tracking-wide">
              Jump Back In
            </h3>
            <span className="text-xs text-[var(--text-dim)] font-mono">
              Recently Active
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from(new Map<string, Audiobook>(history.map(b => [b.id, b])).values()).slice(0, 6).map((book) => (
              <div
                key={`jump-${book.id}`}
                onClick={() => handleBookClick(book)}
                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface)] border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-all cursor-pointer group shadow-md active:scale-[0.98]"
              >
                <div className="w-12 h-16 shrink-0 rounded-lg overflow-hidden bg-[var(--surface)] border border-[var(--border-subtle)]">
                  <img
                    src={book.coverImageUrl}
                    alt={book.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-serif-display italic font-semibold text-[var(--text-main)] truncate group-hover:text-[var(--accent)] transition-colors">
                    {book.title}
                  </h4>
                  <p className="text-[11px] text-[var(--text-dim)] truncate mt-0.5">{book.author}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBookClick(book);
                  }}
                  className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--on-accent)] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform shrink-0"
                >
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dynamic Recommendation Sections */}
      {isLoadingSections ? (
        <div className="space-y-10">
          {[1, 2, 3].map((s) => (
            <div key={s} className="space-y-4">
              <div className="h-6 w-56 bg-[var(--surface-raised)] rounded-lg animate-pulse" />
              <div className="flex items-stretch gap-3.5 overflow-hidden pb-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="w-40 sm:w-44 shrink-0 aspect-[3/4] bg-[var(--surface-raised)] rounded-2xl animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : dynamicSections.length > 0 ? (
        <div className="space-y-10">
          {dynamicSections.map((section) => (
            <HorizontalBookShelf
              key={section.id}
              section={section}
              onSelectBook={handleBookClick}
              onReadBook={onReadBook}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)]">
          <Radio className="w-8 h-8 text-[var(--accent)] mb-3 animate-pulse" />
          <h4 className="text-sm font-serif-display italic font-semibold text-[var(--text-main)]">
            No recommendations right now
          </h4>
          <p className="text-xs text-[var(--text-dim)] mt-1 max-w-xs">
            We couldn't gather fresh shelves. Pull to refresh to try the LibriVox catalog again.
          </p>
          <button
            onClick={handleRefresh}
            className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] text-xs font-semibold hover:opacity-90 transition-all active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Feed
          </button>
        </div>
      )}
    </div>
  );
};

// Sub-component: Horizontal Scrolling Recommendation Rail / Shelf
interface HorizontalShelfProps {
  section: RecommendationSection;
  onSelectBook: (book: Audiobook) => void;
  onReadBook?: (book: Audiobook) => void;
}

const HorizontalBookShelf: React.FC<HorizontalShelfProps> = ({
  section,
  onSelectBook,
  onReadBook,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -320 : 320;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div id={`shelf-section-${section.id}`} className="relative">
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-serif-display italic font-semibold text-[var(--text-main)] tracking-wide">
              {section.title}
            </h3>
            {section.badge && (
              <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]">
                {section.badge}
              </span>
            )}
          </div>
          {section.subtitle && (
            <p className="text-[11px] text-[var(--text-dim)] font-serif-display italic mt-0.5">
              {section.subtitle}
            </p>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-1.5">
          <button
            onClick={() => scroll('left')}
            className="p-1.5 rounded-lg bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] text-[var(--text-dim)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] transition-colors"
            title="Scroll left"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-1.5 rounded-lg bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] text-[var(--text-dim)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] transition-colors"
            title="Scroll right"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex items-stretch gap-3.5 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x snap-mandatory"
      >
        {section.books.map((book) => {
          return (
            <div
              key={book.id}
              id={`shelf-book-${book.id}`}
              onClick={() => onSelectBook(book)}
              className="group w-40 sm:w-44 shrink-0 snap-start flex flex-col bg-[var(--surface)] rounded-2xl border border-[var(--border-subtle)] p-3 hover:border-[var(--accent)] hover:bg-[var(--surface-raised)] transition-all duration-200 cursor-pointer shadow-md active:scale-[0.96]"
            >
              <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden mb-2.5 bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
                <img
                  src={book.coverImageUrl}
                  alt={book.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-9 h-9 rounded-full bg-[var(--accent)] text-[var(--on-accent)] flex items-center justify-center shadow-lg shadow-black transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </div>
                </div>
              </div>

              <h4 className="text-xs font-serif-display italic font-semibold text-[var(--text-main)] truncate leading-tight group-hover:text-[var(--accent)] transition-colors">
                {book.title}
              </h4>
              <p className="text-[10px] text-[var(--text-dim)] font-serif-display italic truncate mt-0.5">
                {book.author}
              </p>

              <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)] mt-auto pt-2 border-t border-[var(--border-subtle)]">
                <span>{book.tracks.length} Ch.</span>
                <span className="text-[var(--accent)] font-mono">{Math.round(book.totalTimeSecs / 3600) || 1}h</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
