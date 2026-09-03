import React, { useState, useEffect } from 'react';
import { Audiobook } from '../types';
import { X, Play, BookOpen, Clock, Sparkles } from 'lucide-react';
import { GenreCategory, fetchLibriVoxCategory } from '../utils/librivoxRecommendations';
import { useCoverAspect, getCoverAspectClass } from '../utils/coverAspect';

interface GenreViewProps {
  genre: GenreCategory | null;
  open: boolean;
  onClose: () => void;
  onSelectBook: (book: Audiobook) => void;
  onReadBook?: (book: Audiobook) => void;
}

export const GenreView: React.FC<GenreViewProps> = ({
  genre,
  open,
  onClose,
  onSelectBook,
  onReadBook,
}) => {
  const [books, setBooks] = useState<Audiobook[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coverAspectClass = getCoverAspectClass(useCoverAspect());

  useEffect(() => {
    if (!open || !genre) return;
    let isMounted = true;

    const query =
      genre.id === 'all'
        ? 'downloads:[1000 TO 9999999]'
        : genre.query;

    setIsLoading(true);
    setError(null);
    setBooks([]);

    const load = async () => {
      try {
        const fetched = await fetchLibriVoxCategory(query, 24);
        const unique = Array.from(
          new Map<string, Audiobook>(fetched.map((b) => [b.title, b])).values()
        );
        if (isMounted) {
          setBooks(unique);
          if (unique.length === 0) {
            setError('No works found for this genre right now. Please try again later.');
          }
        }
      } catch (err) {
        console.warn(`Genre fetch error for ${genre.label}:`, err);
        if (isMounted) setError('Could not reach the LibriVox catalog. Check your connection.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [open, genre]);

  if (!open || !genre) return null;

  const handleBookClick = (book: Audiobook) => {
    // Open the book page immediately; BookDetailModal resolves the full
    // tracklist itself and shows its skeleton while loading.
    onSelectBook(book);
  };

  return (
    <div
      id="genre-view"
      className="fixed inset-0 z-[120] flex flex-col bg-[var(--bg)] animate-in fade-in duration-200 pt-[max(env(safe-area-inset-top),0.5rem)]"
    >
      {/* Header */}
      <header className="h-16 shrink-0 px-4 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg)]">
        <div className="flex items-center gap-2 min-w-0">
          <button
            id="btn-genre-back"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[var(--surface-raised)] text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors"
            title="Back to Search"
          >
            <X className="w-5 h-5" />
          </button>
          <h1 className="text-base font-serif-display italic font-bold text-[var(--text-main)] tracking-wide truncate">
            {genre.label}
          </h1>
        </div>
      </header>

      {/* Hero / Genre description */}
      <div className="px-4 pt-4 pb-1">
        <div className="rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--accent-dim)]/30 via-[var(--surface)] to-[var(--surface-raised)]">
          <div className="p-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] uppercase font-bold tracking-widest bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)] mb-3">
              <Sparkles className="w-3 h-3" /> Browse Genre
            </span>
            <h2 className="text-2xl font-serif-display italic font-bold text-[var(--text-main)] tracking-wide">
              {genre.label}
            </h2>
            {genre.description && (
              <p className="text-xs text-[var(--text-dim)] mt-1.5 leading-relaxed font-serif-display italic">
                {genre.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Book grid */}
      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-thumb-white/10">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`${coverAspectClass} bg-[var(--surface-raised)] rounded-2xl animate-pulse`} />
            ))}
          </div>
        ) : error && books.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-6">
            <Sparkles className="w-7 h-7 text-[var(--accent)] mb-3" />
            <h3 className="text-sm font-serif-display italic font-semibold text-[var(--text-main)]">
              {genre.label} is a little quiet right now
            </h3>
            <p className="text-xs text-[var(--text-dim)] mt-1 max-w-xs">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] text-xs font-semibold hover:opacity-90 transition-all active:scale-95"
            >
              Back to Search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {books.map((book) => (
              <div
                key={book.id}
                id={`genre-book-${book.id}`}
                onClick={() => handleBookClick(book)}
                className="group flex flex-col bg-[var(--surface)] rounded-2xl border border-[var(--border-subtle)] p-3 hover:border-[var(--accent)] hover:bg-[var(--surface-raised)] transition-all duration-200 cursor-pointer shadow-md active:scale-[0.97]"
              >
                <div className={`relative ${coverAspectClass} w-full rounded-xl overflow-hidden mb-2.5 bg-[var(--surface-raised)] border border-[var(--border-subtle)]`}>
                  <img
                    src={book.coverImageUrl}
                    alt={book.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  {onReadBook && (
                    <button
                      id={`btn-genre-read-${book.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReadBook(book);
                      }}
                      className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/60 hover:bg-[var(--accent)] text-[var(--text-main)] hover:text-black border border-[var(--border-subtle)] flex items-center justify-center transition-all shadow-md"
                      title="Read Ebook Text Edition"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-[var(--accent)] text-[var(--on-accent)] flex items-center justify-center shadow-lg shadow-black transform scale-90 group-hover:scale-100 transition-transform">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>

                <h4 className="text-xs font-serif-display italic font-semibold text-[var(--text-main)] truncate leading-tight group-hover:text-[var(--accent)] transition-colors">
                  {book.title}
                </h4>
                <p className="text-[11px] text-[var(--text-dim)] font-serif-display italic truncate mt-0.5">
                  {book.author}
                </p>

                <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)] mt-auto pt-2 border-t border-[var(--border-subtle)]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 text-[var(--accent)]" />
                    {Math.round(book.totalTimeSecs / 3600) || 1}h
                  </span>
                  <span>{book.tracks.length} Ch.</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
