import React, { useState, useEffect } from 'react';
import { Audiobook } from '../types';
import {
  getAuthorRankings,
  AuthorRanking,
  formatTrueDuration,
  formatTrueDurationShort,
} from '../utils/activityTracker';
import { useCoverAspect, getCoverAspectClass } from '../utils/coverAspect';
import {
  Trophy,
  Headphones,
  BookOpen,
  Award,
  ChevronDown,
  ChevronUp,
  Play,
  Sparkles,
  Flame,
  Search,
  Users,
} from 'lucide-react';

interface AuthorRankingsWidgetProps {
  history?: Audiobook[];
  onSelectBook?: (book: Audiobook) => void;
  onPlayBook?: (book: Audiobook) => void;
}

export const AuthorRankingsWidget: React.FC<AuthorRankingsWidgetProps> = ({
  history = [],
  onSelectBook,
  onPlayBook,
}) => {
  const [rankings, setRankings] = useState<AuthorRanking[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'audio' | 'read'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedAuthor, setExpandedAuthor] = useState<string | null>(null);

  const coverAspectClass = getCoverAspectClass(useCoverAspect());

  const refreshRankings = () => {
    const list = getAuthorRankings(history);
    setRankings(list);
  };

  useEffect(() => {
    refreshRankings();
    const interval = setInterval(refreshRankings, 2500);
    return () => clearInterval(interval);
  }, [history]);

  // Filter & Search
  const filteredRankings = rankings
    .filter((a) => {
      if (filterMode === 'audio') return a.listenedSeconds > 0;
      if (filterMode === 'read') return a.readSeconds > 0;
      return true;
    })
    .filter((a) => {
      if (!searchQuery.trim()) return true;
      return a.author.toLowerCase().includes(searchQuery.toLowerCase().trim());
    });

  const getMedalBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="w-6 h-6 rounded-full bg-amber-400 text-black flex items-center justify-center font-bold text-xs shadow-md shadow-amber-400/30">
          🥇
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="w-6 h-6 rounded-full bg-slate-300 text-black flex items-center justify-center font-bold text-xs shadow-md shadow-slate-300/30">
          🥈
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="w-6 h-6 rounded-full bg-amber-700 text-[var(--text-main)] flex items-center justify-center font-bold text-xs shadow-md shadow-amber-700/30">
          🥉
        </span>
      );
    }
    return (
      <span className="w-6 h-6 rounded-full bg-[var(--surface-raised)] text-[var(--text-main)] flex items-center justify-center font-mono font-bold text-xs border border-[var(--border-subtle)]">
        #{rank}
      </span>
    );
  };

  const maxTotalSeconds = rankings.length > 0 ? rankings[0].totalSeconds : 1;

  return (
    <div
      id="author-rankings-container"
      className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] shadow-xl space-y-4"
    >
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--border-subtle)]">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)]">
              <Trophy className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[var(--text-main)]">
              Most Read Authors Leaderboard
            </h3>
          </div>
          <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
            Ranked by total time spent reading & listening to their works
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-[var(--surface-raised)] p-1 rounded-xl border border-[var(--border-subtle)] self-start sm:self-auto">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
              filterMode === 'all'
                ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold shadow-sm'
                : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'
            }`}
          >
            All Time
          </button>
          <button
            onClick={() => setFilterMode('audio')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 ${
              filterMode === 'audio'
                ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold shadow-sm'
                : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'
            }`}
          >
            <Headphones className="w-3 h-3" /> Audio
          </button>
          <button
            onClick={() => setFilterMode('read')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 ${
              filterMode === 'read'
                ? 'bg-blue-400 text-black font-bold shadow-sm'
                : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'
            }`}
          >
            <BookOpen className="w-3 h-3" /> Ebooks
          </button>
        </div>
      </div>

      {/* Optional Search if more than 4 authors */}
      {rankings.length > 4 && (
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[var(--text-dim)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search author rankings..."
            className="w-full bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[var(--text-main)] placeholder-white/30 focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      )}

      {/* Rankings List */}
      {filteredRankings.length === 0 ? (
        <div className="py-10 text-center space-y-2 bg-[var(--surface-raised)] rounded-2xl border border-[var(--border-subtle)] p-4">
          <Users className="w-8 h-8 text-[var(--text-dim)] mx-auto" />
          <p className="text-xs font-serif-display italic text-[var(--text-dim)]">
            No author activity recorded yet
          </p>
          <p className="text-[11px] text-[var(--text-dim)] max-w-xs mx-auto leading-relaxed">
            Listen to audiobooks or read ebooks to automatically build your author rankings.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredRankings.map((item) => {
            const isExpanded = expandedAuthor === item.author;
            const progressPercent = Math.min(
              100,
              Math.max(8, Math.round((item.totalSeconds / maxTotalSeconds) * 100))
            );

            return (
              <div
                key={item.author}
                id={`author-rank-row-${item.rank}`}
                className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                  item.rank === 1
                    ? 'bg-gradient-to-r from-[#171510] to-[var(--surface-raised)] border-[var(--accent)] shadow-lg shadow-[rgba(var(--accent-rgb),0.3)]'
                    : 'bg-[var(--surface-raised)] border-[var(--border-subtle)] hover:border-[var(--border-subtle)]'
                }`}
              >
                {/* Main Author Bar */}
                <div
                  onClick={() =>
                    setExpandedAuthor(isExpanded ? null : item.author)
                  }
                  className="p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                >
                  {/* Left: Medal + Author Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="shrink-0">{getMedalBadge(item.rank)}</div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-serif-display italic font-bold text-[var(--text-main)] truncate">
                          {item.author}
                        </h4>
                        {item.rank === 1 && (
                          <span className="shrink-0 text-[9px] font-bold text-[var(--accent)] bg-[var(--accent-dim)] px-1.5 py-0.5 rounded-full border border-[var(--accent)] flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> Top Author
                          </span>
                        )}
                      </div>

                      {/* Time Details & Breakdown */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-[var(--text-dim)]">
                        <span className="font-mono font-bold text-[var(--text-main)]">
                          {formatTrueDurationShort(item.totalSeconds)} total
                        </span>
                        {item.listenedSeconds > 0 && (
                          <span className="flex items-center gap-1 text-[var(--accent)]">
                            <Headphones className="w-3 h-3" />
                            <span>{formatTrueDurationShort(item.listenedSeconds)}</span>
                          </span>
                        )}
                        {item.readSeconds > 0 && (
                          <span className="flex items-center gap-1 text-blue-400">
                            <BookOpen className="w-3 h-3" />
                            <span>{formatTrueDurationShort(item.readSeconds)}</span>
                          </span>
                        )}
                        <span className="text-[var(--text-dim)]">
                          {item.booksCount} title{item.booksCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Relative Progress Bar & Accordion Caret */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:flex flex-col items-end w-24">
                      <span className="text-[10px] font-mono text-[var(--text-dim)]">
                        {item.percentageOfTotal}% share
                      </span>
                      <div className="w-full h-1.5 bg-[var(--surface-raised)] rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.rank === 1 ? 'bg-[var(--accent)]' : 'bg-[var(--surface-raised)]'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    <button
                      className="p-1 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface-raised)]"
                      title={isExpanded ? 'Collapse books' : 'View books'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details: Book Breakdown for this Author */}
                {isExpanded && item.books.length > 0 && (
                  <div className="px-4 pb-4 pt-1 border-t border-[var(--border-subtle)] bg-black/40 space-y-2 animate-in fade-in duration-200">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] font-semibold mb-2">
                      Titles read by {item.author}:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {item.books.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-all"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {b.coverImageUrl && (
                              <img
                                src={b.coverImageUrl}
                                alt={b.title}
                                className={`w-8 ${coverAspectClass} object-cover rounded-lg bg-black/40 shrink-0 border border-[var(--border-subtle)]`}
                                referrerPolicy="no-referrer"
                              />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-serif-display italic text-[var(--text-main)] font-medium truncate">
                                {b.title}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-[var(--text-dim)] font-mono mt-0.5">
                                <span>{formatTrueDurationShort(b.seconds)}</span>
                                {b.listenedSeconds > 0 && <span>🎧 {formatTrueDurationShort(b.listenedSeconds)}</span>}
                                {b.readSeconds > 0 && <span>📖 {formatTrueDurationShort(b.readSeconds)}</span>}
                              </div>
                            </div>
                          </div>

                          {onPlayBook && (
                            <button
                              onClick={() =>
                                onPlayBook({
                                  id: b.id,
                                  title: b.title,
                                  author: item.author,
                                  description: '',
                                  coverImageUrl: b.coverImageUrl || '',
                                  language: 'English',
                                  totalTimeSecs: b.seconds,
                                  tracks: [],
                                })
                              }
                              className="p-1.5 rounded-lg bg-[var(--accent-dim)] hover:bg-[var(--accent)] text-[var(--accent)] hover:text-black transition-colors shrink-0"
                              title="Play Audiobook"
                            >
                              <Play className="w-3 h-3 fill-current" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
