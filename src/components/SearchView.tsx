import React, { useState, useEffect, useRef } from 'react';
import { Audiobook, AudioTrack } from '../types';
import { Search, X, Play, Clock, BookOpen, SearchX, Ghost, Compass, Brain, Anchor, Heart, Feather, Landmark, Smile, LayoutGrid, ArrowLeft, User, Rocket, Wand, Baby, Drama, BookText, Leaf, Globe, Church, Columns, Scroll, Trophy, FlaskConical, Music, Shield, Zap, Map as MapIcon, Scale, Target, Lightbulb, GraduationCap, Mail, Home } from 'lucide-react';
import {
  resolveFullTracklist,
  mapArchiveDocToAudiobook,
  LIBRIVOX_GENRES,
  fetchLibriVoxCategory,
  GenreCategory,
} from '../utils/librivoxRecommendations';
import { downloadAudiobook, isBookDownloaded } from '../utils/offlineStorage';
import { getSavedQualityPreference } from '../utils/audioQualityManager';
import { httpGetJson } from '../utils/httpClient';
import { useCoverAspect, getCoverAspectClass } from '../utils/coverAspect';

const GENRE_ICONS: Record<string, typeof Search> = {
  Search,
  Ghost,
  Rocket,
  Wand,
  Brain,
  Anchor,
  Heart,
  Feather,
  Landmark,
  Smile,
  Baby,
  Drama,
  BookText,
  Leaf,
  Globe,
  Church,
  Columns,
  Scroll,
  Trophy,
  FlaskConical,
  Music,
  Shield,
  Zap,
  MapIcon,
  Scale,
  Target,
  Lightbulb,
  GraduationCap,
  Mail,
  Home,
};

interface SearchViewProps {
  allBooks: Audiobook[];
  onSelectBook: (book: Audiobook) => void;
  onReadBook?: (book: Audiobook) => void;
  onUploadEpub?: (book: Audiobook) => void;
  onOpenGenre?: (genreId: string) => void;
  onOpenProfile?: () => void;
}

export const SearchView: React.FC<SearchViewProps> = ({
  allBooks,
  onSelectBook,
  onReadBook,
  onUploadEpub,
  onOpenGenre,
  onOpenProfile,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Audiobook[]>([]);
  const [resolvingBookId, setResolvingBookId] = useState<string | null>(null);
  const [downloadProgressMap, setDownloadProgressMap] = useState<Record<string, number>>({});
  const [downloadedStatusMap, setDownloadedStatusMap] = useState<Record<string, boolean>>({});
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [activeGenre, setActiveGenre] = useState<GenreCategory | null>(null);
  const [genreBooks, setGenreBooks] = useState<Audiobook[]>([]);
  const [isGenreLoading, setIsGenreLoading] = useState(false);
  const [genreError, setGenreError] = useState<string | null>(null);

  const coverAspectClass = getCoverAspectClass(useCoverAspect());

  const HISTORY_KEY = 'libriaudio_search_history';

  // Load search history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setSearchHistory(parsed.slice(0, 10));
      }
    } catch {
      // ignore corrupt history
    }
  }, []);

  // Persist a search term to history (dedup, most recent first, max 10)
  const saveToHistory = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setSearchHistory((prev) => {
      const next = [trimmed, ...prev.filter((t) => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, 10);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const clearHistory = () => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // ignore
    }
  };

  // Debounce search input
  useEffect(() => {
    setIsSearching(true);
    const handler = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Check downloaded status
  const checkStatus = async (books: Audiobook[]) => {
    const statusMap: Record<string, boolean> = {};
    await Promise.all(books.map(async (b) => {
      statusMap[b.id] = await isBookDownloaded(b.id);
    }));
    setDownloadedStatusMap((prev) => ({ ...prev, ...statusMap }));
  };

  // Perform multi-source search (Local + LibriVox Feed + Internet Archive) with cancellation
  useEffect(() => {
    if (!debouncedTerm.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    const query = debouncedTerm.toLowerCase().trim();
    const localMatches = allBooks.filter(
      (book) =>
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query) ||
        book.description.toLowerCase().includes(query)
    );

    const controller = new AbortController();

    const fetchLibriVoxAndArchive = async () => {
      const combined: Audiobook[] = [...localMatches];
      const errors: string[] = [];

      // Fire both API searches in parallel
      const [archiveRes, lvRes] = await Promise.allSettled([
        httpGetJson(
          `https://archive.org/advancedsearch.php?q=collection:(librivoxaudio)+AND+(title:(${encodeURIComponent(
            query
          )})+OR+creator:(${encodeURIComponent(query)}))&fl[]=identifier,title,creator,description,year,runtime,downloads&sort[]=downloads+desc&output=json&rows=12`,
          { timeout: 15000, retries: 2 }
        ),
        httpGetJson(
          `https://librivox.org/api/feed/audiobooks?format=json&title=${encodeURIComponent(
            query
          )}&limit=8&extended=1`,
          { timeout: 15000, retries: 2 }
        ),
      ]);

      if (archiveRes.status === 'rejected' || (archiveRes.status === 'fulfilled' && !archiveRes.value.ok)) {
        errors.push('Internet Archive');
      }
      if (lvRes.status === 'rejected' || (lvRes.status === 'fulfilled' && !lvRes.value.ok)) {
        errors.push('LibriVox');
      }

      // Process Archive results — reuse shared mapper
      if (archiveRes.status === 'fulfilled' && archiveRes.value.ok && archiveRes.value.data) {
        const docs = archiveRes.value.data.response?.docs;
        if (Array.isArray(docs)) {
          docs.forEach((doc: any) => {
            const id = doc.identifier;
            if (id && !combined.some((b) => b.id === id || b.title.toLowerCase() === (doc.title || '').toLowerCase())) {
              combined.push(mapArchiveDocToAudiobook(doc));
            }
          });
        }
      }

      // Process LibriVox direct results
      if (lvRes.status === 'fulfilled' && lvRes.value.ok && lvRes.value.data) {
        const books = lvRes.value.data.books;
        if (Array.isArray(books)) {
          books.forEach((b: any) => {
            const id = String(b.id);
            if (!combined.some((c) => c.id === id)) {
              combined.push({
                id,
                title: b.title || 'Untitled',
                author: b.authors?.[0]
                  ? `${b.authors[0].first_name || ''} ${b.authors[0].last_name || ''}`.trim()
                  : 'Public Domain Author',
                description: (b.description || '').replace(/<[^>]*>/g, '').trim(),
                coverImageUrl:
                  b.coverart_jpg ||
                  `https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=800`,
                language: b.language || 'English',
                totalTimeSecs: parseInt(b.totaltimesecs, 10) || 3600,
                reader: b.sections?.[0]?.readers?.[0]?.display_name || 'LibriVox Reader',
                tracks:
                  b.sections && Array.isArray(b.sections) && b.sections.length > 0
                    ? b.sections.map((s: any, idx: number) => ({
                        id: `sec_${b.id}_${s.id || idx}`,
                        title: s.title || `Section ${idx + 1}`,
                        audioUrl: s.listen_url || '',
                        durationSeconds: parseInt(s.playtime, 10) || 1200,
                        trackNumber: idx + 1,
                      }))
                    : [
                        {
                          id: `tr_${b.id}_1`,
                          title: `${b.title} - Full Audiobook`,
                          audioUrl: b.url_librivox || '',
                          durationSeconds: 1800,
                          trackNumber: 1,
                        },
                      ],
              });
            }
          });
        }
      }

      if (!controller.signal.aborted) {
        setResults(combined);
        setIsSearching(false);
        setSearchError(
          errors.length > 0 && combined.length === 0
            ? `Could not reach ${errors.join(' & ')}. Check your connection and try again.`
            : errors.length > 0 && combined.length > 0
            ? `Some sources unavailable (${errors.join(', ')}). Showing partial results.`
            : null
        );
        checkStatus(combined);
      }
    };

    fetchLibriVoxAndArchive();

    return () => {
      controller.abort();
    };
  }, [debouncedTerm, allBooks]);

  const handleDownloadDirect = async (e: React.MouseEvent, book: Audiobook) => {
    e.stopPropagation();
    if (downloadProgressMap[book.id] !== undefined || downloadedStatusMap[book.id]) return;

    setDownloadProgressMap((prev) => ({ ...prev, [book.id]: 5 }));
    try {
      const resolved = await resolveFullTracklist(book);
      await downloadAudiobook(resolved, (percent) => {
        setDownloadProgressMap((prev) => ({ ...prev, [book.id]: percent }));
      });
      setDownloadedStatusMap((prev) => ({ ...prev, [book.id]: true }));
    } catch (err) {
      console.warn('Search card download error:', err);
    } finally {
      setDownloadProgressMap((prev) => {
        const next = { ...prev };
        delete next[book.id];
        return next;
      });
    }
  };

  const handleBookClick = (book: Audiobook) => {
    saveToHistory(searchTerm);
    // Open the book page immediately; BookDetailModal resolves the full
    // tracklist itself and shows its skeleton while loading.
    onSelectBook(book);
  };

  // Load books for the active genre in-place (below the fixed search bar).
  useEffect(() => {
    if (!activeGenre) {
      setGenreBooks([]);
      setIsGenreLoading(false);
      setGenreError(null);
      return;
    }

    let isMounted = true;
    setIsGenreLoading(true);
    setGenreError(null);

    // Prefer books already in the local catalog when the genre id matches.
    const local = allBooks.filter(
      (b) => b.genre && b.genre.toLowerCase().includes(activeGenre.label.toLowerCase())
    );

    fetchLibriVoxCategory(activeGenre.query)
      .then((books) => {
        if (!isMounted) return;
        const merged = [...local];
        for (const b of books) {
          if (!merged.some((x) => x.id === b.id)) merged.push(b);
        }
        setGenreBooks(merged);
        setIsGenreLoading(false);
        checkStatus(merged);
      })
      .catch(() => {
        if (!isMounted) return;
        setGenreError('Could not load this genre. Check your connection and try again.');
        setIsGenreLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeGenre, allBooks]);

  const handleOpenGenre = (genreId: string) => {
    const genre = LIBRIVOX_GENRES.find((g) => g.id === genreId) || null;
    setActiveGenre(genre);
  };

  const handleCloseGenre = () => {
    setActiveGenre(null);
    setGenreBooks([]);
  };

  return (
    <div id="search-view-container" className="w-full h-full flex flex-col text-[var(--text-main)]">
      {/* Fixed (non-scrolling) header: title + search bar + quick chips */}
      <div id="search-header" className="shrink-0">
        <div className="flex items-center justify-between mb-3">
          <button
            id="btn-profile-search"
            onClick={onOpenProfile}
            className="w-9 h-9 rounded-full bg-[var(--surface)] border border-[var(--border-subtle)] hover:border-[var(--accent)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--accent)] transition-all shrink-0"
            aria-label="Profile menu"
          >
            <User className="w-4 h-4" />
          </button>
          <h1 className="text-xl font-serif-display italic font-bold text-[var(--text-main)] tracking-wide">
            Search Catalog
          </h1>
        </div>

        {/* Search Input Bar */}
        <div id="search-input-wrapper" className="relative mb-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--accent)]" />
          <input
            id="input-audiobook-search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveToHistory(searchTerm);
            }}
            placeholder="Search any title, author, or keyword (e.g. Dracula, Poe)..."
            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] focus:border-[var(--accent)] text-xs text-[var(--text-main)] placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all"
          />
        {searchTerm && (
          <button
            id="btn-clear-search"
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-main)]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Quick Search Chips */}
      {searchHistory.length > 0 && (
        <div id="quick-search-chips" className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-none">
          {searchHistory.map((term) => (
            <button
              key={term}
              id={`history-chip-${term.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'term'}`}
              onClick={() => setSearchTerm(term)}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] text-[10px] font-medium text-[var(--text-main)] hover:text-[var(--accent)] border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-all font-serif-display italic whitespace-nowrap"
            >
              {term}
            </button>
          ))}
          <button
            id="btn-clear-history"
            onClick={clearHistory}
            title="Clear search history"
            className="shrink-0 px-2 py-1 text-[10px] text-[var(--text-dim)] hover:text-red-400 transition-colors"
          >
            <X className="w-3 h-3 inline-block" /> Clear
          </button>
        </div>
      )}

      {/* Error Banner */}
      {searchError && (
        <div className="mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-serif-display italic flex items-center gap-2">
          <span className="shrink-0">!</span>
          <span>{searchError}</span>
          <button onClick={() => setSearchError(null)} className="ml-auto shrink-0 text-red-400/60 hover:text-red-400">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      </div>{/* end fixed header */}

      {/* Scrollable Content: genre browser, genre books, or search results */}
      <div id="search-results-wrapper" className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 pb-40">
        {activeGenre ? (
          <div id="genre-books-wrapper" className="flex flex-col pb-2">
            <div className="flex items-center gap-2 mb-3">
              <button
                id="btn-back-from-genre"
                onClick={handleCloseGenre}
                className="shrink-0 w-8 h-8 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-raised)] text-[var(--text-dim)] hover:text-[var(--accent)] flex items-center justify-center border border-[var(--border-subtle)] transition-colors"
                title="Back to genres"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 min-w-0">
                {(() => {
                  const Icon = GENRE_ICONS[activeGenre.iconName] || Compass;
                  return <Icon className="w-4 h-4 text-[var(--accent)] shrink-0" />;
                })()}
                <h3 className="text-sm font-serif-display italic font-semibold text-[var(--text-main)] tracking-wide truncate">
                  {activeGenre.label}
                </h3>
              </div>
            </div>

            {isGenreLoading ? (
              <div className="flex flex-col items-center justify-center h-48 text-[var(--text-dim)]">
                <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-2.5" />
                <p className="text-xs font-serif-display italic">Loading {activeGenre.label} audiobooks...</p>
              </div>
            ) : genreError ? (
              <div className="flex flex-col items-center justify-center py-12 text-[var(--text-dim)] text-center px-4 space-y-3">
                <SearchX className="w-8 h-8 text-[var(--text-dim)]" />
                <p className="text-xs font-serif-display italic max-w-[280px]">{genreError}</p>
              </div>
            ) : genreBooks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[var(--text-dim)] text-center px-4 space-y-3">
                <LayoutGrid className="w-8 h-8 text-[var(--text-dim)]" />
                <p className="text-xs font-serif-display italic">No books found in this genre.</p>
              </div>
            ) : (
              <div id="genre-results-list" className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] uppercase tracking-widest text-[var(--text-dim)] font-medium">{genreBooks.length} Works</p>
                </div>
                {genreBooks.map((book) => {
                  const isDownloaded = !!downloadedStatusMap[book.id];
                  const downloadProg = downloadProgressMap[book.id];
                  return (
                    <div
                      key={book.id}
                      id={`genre-result-${book.id}`}
                      onClick={() => handleBookClick(book)}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] hover:border-[var(--accent)] hover:bg-[var(--surface-raised)] transition-all cursor-pointer group active:scale-[0.98]"
                    >
                      <div className={`w-11 ${coverAspectClass} shrink-0 rounded-lg overflow-hidden bg-[var(--surface)] border border-[var(--border-subtle)] relative`}>
                        <img
                          src={book.coverImageUrl}
                          alt={book.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=800';
                          }}
                        />
                        {downloadProg !== undefined && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-serif-display italic font-medium text-[var(--text-main)] truncate group-hover:text-[var(--accent)] transition-colors">
                          {book.title}
                        </h4>
                        <p className="text-[11px] text-[var(--text-dim)] font-serif-display italic truncate mt-0.5">{book.author}</p>
                        <div className="flex items-center gap-2 text-[10px] text-[var(--text-dim)] mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-[var(--accent)]" />
                            {Math.round(book.totalTimeSecs / 3600) || 1}h
                          </span>
                          <span>•</span>
                          <span className="text-[var(--accent)] uppercase tracking-wider text-[9px]">{book.language}</span>
                          <span>•</span>
                          <span className="text-[var(--text-dim)] truncate">{book.tracks.length} track{book.tracks.length > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {onReadBook && (
                          <button
                            id={`btn-read-genre-${book.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onReadBook(book);
                            }}
                            className="w-8 h-8 rounded-full bg-[var(--surface-raised)] hover:bg-[var(--accent-dim)] text-[var(--text-dim)] hover:text-[var(--accent)] flex items-center justify-center transition-all border border-[var(--border-subtle)] hover:border-[var(--accent)]"
                            title="Read Ebook Edition"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          id={`btn-play-genre-${book.id}`}
                          onClick={() => handleBookClick(book)}
                          className="w-8 h-8 rounded-full bg-[var(--surface-raised)] group-hover:bg-[var(--accent)] text-[var(--text-dim)] group-hover:text-black flex items-center justify-center transition-all border border-[var(--border-subtle)] group-hover:border-[var(--accent)] group-hover:shadow-[0_0_12px_rgba(var(--accent-rgb),0.4)]"
                          title="Open Book Details & Chapters"
                        >
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : isSearching ? (
          <div className="flex flex-col items-center justify-center h-48 text-[var(--text-dim)]">
            <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-2.5" />
            <p className="text-xs font-serif-display italic">Searching LibriVox & Internet Archive catalogs...</p>
          </div>
        ) : debouncedTerm.trim() === '' && !activeGenre ? (
          <div id="search-empty-prompt" className="flex flex-col pb-6 text-[var(--text-dim)]">
            {/* Browse Genres (Spotify-style) */}
            <div id="browse-genres-section" className="mt-1">
              <div className="flex items-center gap-2 mb-3">
                <LayoutGrid className="w-4 h-4 text-[var(--accent)]" />
                <h3 className="text-sm font-serif-display italic font-semibold text-[var(--text-main)] tracking-wide">
                  Browse Genres
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {LIBRIVOX_GENRES.map((genre) => {
                  const Icon = GENRE_ICONS[genre.iconName] || Compass;
                  return (
                    <button
                      key={genre.id}
                      id={`genre-tile-${genre.id}`}
                      onClick={() => handleOpenGenre(genre.id)}
                      className="group flex items-center gap-3 p-3 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-raised)] border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-all active:scale-[0.98] text-left cursor-pointer"
                    >
                      <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-[var(--accent-dim)] to-[var(--surface-raised)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent)] group-hover:from-[var(--accent)] group-hover:to-[var(--accent)] group-hover:text-black transition-all">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-serif-display italic font-semibold text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors truncate">
                          {genre.label}
                        </p>
                        <p className="text-[10px] text-[var(--text-dim)] truncate mt-0.5 hidden sm:block">
                          {genre.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : results.length === 0 ? (
          <div id="search-no-results" className="flex flex-col items-center justify-center py-12 text-[var(--text-dim)] text-center px-4 space-y-3">
            <SearchX className="w-8 h-8 text-[var(--text-dim)]" />
            <div>
              <h3 className="text-sm font-serif-display italic font-medium text-[var(--text-main)]">No results found for &ldquo;{debouncedTerm}&rdquo;</h3>
              <p className="text-xs text-[var(--text-dim)] mt-1">Try searching with a different author, title, or keyword.</p>
            </div>
          </div>
        ) : (
          <div id="search-results-list" className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] uppercase tracking-widest text-[var(--text-dim)] font-medium">{results.length} Works Found</p>
            </div>
            {results.map((book) => {
              const isResolving = resolvingBookId === book.id;
              const isDownloaded = !!downloadedStatusMap[book.id];
              const downloadProg = downloadProgressMap[book.id];

              return (
                <div
                  key={book.id}
                  id={`search-result-${book.id}`}
                  onClick={() => handleBookClick(book)}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] hover:border-[var(--accent)] hover:bg-[var(--surface-raised)] transition-all cursor-pointer group active:scale-[0.98]"
                >
                  <div className={`w-11 ${coverAspectClass} shrink-0 rounded-lg overflow-hidden bg-[var(--surface)] border border-[var(--border-subtle)] relative`}>
                    <img
                      src={book.coverImageUrl}
                      alt={book.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=800';
                      }}
                    />
                    {isResolving && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-serif-display italic font-medium text-[var(--text-main)] truncate group-hover:text-[var(--accent)] transition-colors">
                      {book.title}
                    </h4>
                    <p className="text-[11px] text-[var(--text-dim)] font-serif-display italic truncate mt-0.5">{book.author}</p>
                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-dim)] mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 text-[var(--accent)]" />
                        {Math.round(book.totalTimeSecs / 3600) || 1}h
                      </span>
                      <span>•</span>
                      <span className="text-[var(--accent)] uppercase tracking-wider text-[9px]">{book.language}</span>
                      <span>•</span>
                      <span className="text-[var(--text-dim)] truncate">{book.tracks.length} track{book.tracks.length > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {onReadBook && (
                      <button
                        id={`btn-read-result-${book.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onReadBook(book);
                        }}
                        className="w-8 h-8 rounded-full bg-[var(--surface-raised)] hover:bg-[var(--accent-dim)] text-[var(--text-dim)] hover:text-[var(--accent)] flex items-center justify-center transition-all border border-[var(--border-subtle)] hover:border-[var(--accent)]"
                        title="Read Ebook Edition"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      id={`btn-play-result-${book.id}`}
                      className="w-8 h-8 rounded-full bg-[var(--surface-raised)] group-hover:bg-[var(--accent)] text-[var(--text-dim)] group-hover:text-black flex items-center justify-center transition-all border border-[var(--border-subtle)] group-hover:border-[var(--accent)] group-hover:shadow-[0_0_12px_rgba(var(--accent-rgb),0.4)]"
                      title="Open Book Details & Chapters"
                    >
                      {isResolving ? (
                        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
