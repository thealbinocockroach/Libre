import React, { useState, useEffect } from 'react';
import { Audiobook, AudioTrack, PlayerState } from '../types';
import {
  X,
  Play,
  Pause,
  Clock,
  BookOpen,
  Bookmark,
  Download,
  Check,
  User,
  Radio,
  FileText,
  Volume2,
  Sparkles,
  Layers,
  Headphones,
  CheckCircle2,
  Trash2,
  Activity,
  Plus,
  Copy,
} from 'lucide-react';
import { resolveFullTracklist } from '../utils/librivoxRecommendations';
import {
  getBookDownloadSummary,
  deleteDownloadedTrack,
  formatBytes,
} from '../utils/offlineStorage';
import {
  getBookActivity,
  formatTrueDuration,
  formatTrueDurationShort,
} from '../utils/activityTracker';
import { getNotesForBook, exportBookNotesAsMarkdown, deleteBookNote } from '../utils/notesStorage';
import { BookNote, AudioQualityPreference } from '../types';
import { ChapterDownloadModal } from './ChapterDownloadModal';
import { BookNotesModal } from './BookNotesModal';
import {
  applyQualityToAudiobook,
  getSavedQualityPreference,
  saveQualityPreference,
} from '../utils/audioQualityManager';
import { useCoverAspect, getCoverAspectClass } from '../utils/coverAspect';

interface BookDetailModalProps {
  isOpen: boolean;
  book: Audiobook | null;
  playerState: PlayerState;
  onClose: () => void;
  onPlayBook: (book: Audiobook, trackIndex?: number) => void;
  onTogglePlayPause: () => void;
  onOpenEbookReader: (book: Audiobook) => void;
  onToggleSaveBook: (book: Audiobook) => void;
  isSaved: boolean;
}

export const BookDetailModal: React.FC<BookDetailModalProps> = ({
  isOpen,
  book,
  playerState,
  onClose,
  onPlayBook,
  onTogglePlayPause,
  onOpenEbookReader,
  onToggleSaveBook,
  isSaved,
}) => {
  const [resolvedBook, setResolvedBook] = useState<Audiobook | null>(book);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'chapters' | 'notes'>('info');
  const [showChapterDownloadModal, setShowChapterDownloadModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [bookNotes, setBookNotes] = useState<BookNote[]>([]);

  const coverAspectClass = getCoverAspectClass(useCoverAspect());

  const [downloadSummary, setDownloadSummary] = useState<{
    isFullyDownloaded: boolean;
    isPartiallyDownloaded: boolean;
    downloadedCount: number;
    totalTracks: number;
    downloadedTrackIds: string[];
    sizeBytes: number;
  }>({
    isFullyDownloaded: false,
    isPartiallyDownloaded: false,
    downloadedCount: 0,
    totalTracks: 1,
    downloadedTrackIds: [],
    sizeBytes: 0,
  });

  const [activity, setActivity] = useState(book ? getBookActivity(book.id) : null);

  const refreshOfflineState = async (targetBook: Audiobook) => {
    const summary = await getBookDownloadSummary(targetBook);
    setDownloadSummary(summary);
  };

  const refreshActivity = (bookId: string) => {
    setActivity(getBookActivity(bookId));
  };

  const refreshNotes = (bookId: string) => {
    setBookNotes(getNotesForBook(bookId));
  };

  // Load and resolve chapters when book changes
  useEffect(() => {
    if (!book) return;
    setResolvedBook(book);
    refreshOfflineState(book);
    refreshActivity(book.id);
    refreshNotes(book.id);

    let isMounted = true;

    // Resolve the full tracklist here so the detail page can open instantly and
    // show its skeleton while chapters/quality data load. This keeps quality
    // preferences applied no matter how the caller opened the book.
    const applyIfReady = (fullBook: Audiobook) => {
      if (!isMounted) return;
      setResolvedBook(fullBook);
      setIsLoadingChapters(false);
      refreshOfflineState(fullBook);
    };

    if (book.tracks.length > 1 && book.qualitySegments) {
      // Already fully resolved — apply the saved quality preference synchronously,
      // avoiding any loading flicker for previously-opened books.
      applyIfReady(applyQualityToAudiobook(book));
    } else {
      setIsLoadingChapters(true);
      resolveFullTracklist(book).then(applyIfReady).catch(() => {
        if (isMounted) setIsLoadingChapters(false);
      });
    }

    return () => {
      isMounted = false;
    };
  }, [book?.id]);

  useEffect(() => {
    if (!book) return;
    const handleNotesEvent = () => refreshNotes(book.id);
    window.addEventListener('libriaudio_notes_updated', handleNotesEvent);
    return () => window.removeEventListener('libriaudio_notes_updated', handleNotesEvent);
  }, [book?.id]);

  // Periodic refresh for live true activity time while open
  useEffect(() => {
    if (!book || !isOpen) return;
    const interval = setInterval(() => {
      refreshActivity(book.id);
    }, 2000);
    return () => clearInterval(interval);
  }, [book?.id, isOpen]);

  if (!isOpen || !book) return null;

  const currentActiveBook = resolvedBook || book;
  const isCurrentPlayingBook = playerState.currentBook?.id === currentActiveBook.id;
  const isPlaying = isCurrentPlayingBook && playerState.isPlaying;

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const handlePrimaryPlayClick = () => {
    if (isCurrentPlayingBook) {
      onTogglePlayPause();
    } else {
      onPlayBook(currentActiveBook, 0);
    }
  };

  return (
    <>
      <div
        id="book-detail-modal-overlay"
        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          id="book-detail-modal-card"
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[90vh] bg-[var(--surface)] rounded-t-3xl sm:rounded-3xl border border-[var(--border-subtle)] shadow-2xl overflow-hidden flex flex-col my-auto"
        >
          {/* Modal Top Action Bar */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)] bg-[var(--accent-dim)] px-2.5 py-1 rounded-full border border-[var(--accent-dim)] flex items-center gap-1.5">
                <Radio className="w-3 h-3 animate-pulse text-[var(--accent)]" /> LibriVox Collection
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Save to Library Bookmark */}
              <button
                id="btn-detail-toggle-save"
                onClick={() => onToggleSaveBook(currentActiveBook)}
                className={`p-2 rounded-xl transition-all ${
                  isSaved
                    ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-md'
                    : 'bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] text-[var(--text-main)] hover:text-[var(--text-main)] border border-[var(--border-subtle)]'
                }`}
                title={isSaved ? 'Saved in Library' : 'Save to Library'}
              >
                <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
              </button>

              {/* Offline Download Options Launcher */}
              <button
                id="btn-detail-download-launcher"
                onClick={() => setShowChapterDownloadModal(true)}
                className={`p-2 rounded-xl transition-all flex items-center gap-1.5 ${
                  downloadSummary.isFullyDownloaded
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : downloadSummary.isPartiallyDownloaded
                    ? 'bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]'
                    : 'bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] text-[var(--text-main)] hover:text-[var(--text-main)] border border-[var(--border-subtle)]'
                }`}
                title="Download specific chapters or full book for offline"
              >
                {downloadSummary.isFullyDownloaded ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>

              {/* Close Modal Button */}
              <button
                id="btn-close-book-detail"
                onClick={onClose}
                className="p-2 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] text-[var(--text-dim)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] transition-colors ml-1"
                title="Close Details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="overflow-y-auto p-5 sm:p-6 space-y-6 scrollbar-none flex-1">
            {/* Main Book Header Info & Primary Controls */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 bg-[var(--surface-raised)] p-5 rounded-2xl border border-[var(--border-subtle)]">
              {/* Book Cover Artwork */}
              <div
                className={`relative w-32 sm:w-36 ${coverAspectClass} shrink-0 rounded-xl overflow-hidden shadow-2xl shadow-black border border-[var(--border-subtle)] bg-[var(--surface-raised)]`}
              >
                <img
                  src={currentActiveBook.coverImageUrl}
                  alt={currentActiveBook.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-between p-2">
                  <span className="text-[10px] font-semibold text-[var(--text-main)] bg-black/70 px-2 py-0.5 rounded-full backdrop-blur-xs border border-[var(--border-subtle)]">
                    {currentActiveBook.tracks.length} Ch.
                  </span>
                </div>
              </div>

              {/* Book Metadata & Primary Play Buttons */}
              <div className="flex-1 min-w-0 text-center sm:text-left flex flex-col justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-serif-display italic font-bold text-[var(--text-main)] tracking-wide leading-tight">
                    {currentActiveBook.title}
                  </h2>
                  <p className="text-sm font-serif-display italic text-[var(--accent)] font-medium mt-1">
                    {currentActiveBook.author}
                  </p>

                  {/* Narrator & Runtime Badges */}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3 text-xs text-[var(--text-dim)]">
                    <span className="flex items-center gap-1 bg-[var(--surface-raised)] px-2.5 py-1 rounded-lg border border-[var(--border-subtle)]">
                      <User className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span className="truncate max-w-[160px]">
                        {currentActiveBook.reader || 'LibriVox Community'}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 bg-[var(--surface-raised)] px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] font-mono">
                      <Clock className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>{formatDuration(currentActiveBook.totalTimeSecs)}</span>
                    </span>
                    <span className="bg-[var(--surface-raised)] px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] uppercase text-[10px] font-bold text-[var(--accent)]">
                      {currentActiveBook.language || 'English'}
                    </span>
                  </div>
                </div>

                {/* Big Action Buttons Row */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mt-5 pt-3 border-t border-[var(--border-subtle)]">
                  <button
                    id={`btn-play-book-detail-${currentActiveBook.id}`}
                    onClick={handlePrimaryPlayClick}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] text-xs font-bold shadow-[0_0_20px_rgba(var(--accent-rgb),0.35)] transition-all active:scale-95"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-4 h-4 fill-current" />
                        <span>Pause Audio</span>
                      </>
                    ) : isCurrentPlayingBook ? (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Resume Audio</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Play Audiobook</span>
                      </>
                    )}
                  </button>

                  <button
                    id="btn-detail-read-ebook"
                    onClick={() => {
                      onClose();
                      onOpenEbookReader(currentActiveBook);
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--accent-dim)] text-[var(--text-main)] hover:text-[var(--accent)] border border-[var(--border-subtle)] hover:border-[var(--accent)] text-xs font-semibold transition-all active:scale-95"
                    title="Read Ebook Text"
                  >
                    <BookOpen className="w-4 h-4 text-[var(--accent)]" />
                    <span>Read Ebook</span>
                  </button>

                  {/* Choose Chapters Download Button (Appears inside opened book) */}
                  <button
                    id="btn-detail-open-download-choices"
                    onClick={() => setShowChapterDownloadModal(true)}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] text-[var(--text-main)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] text-xs font-medium transition-all"
                  >
                    <Download className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>
                      {downloadSummary.isFullyDownloaded
                        ? 'Downloaded'
                        : downloadSummary.isPartiallyDownloaded
                        ? `${downloadSummary.downloadedCount}/${downloadSummary.totalTracks} Ch. Ready`
                        : 'Download Chapters'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* True Activity History Callout for this Book */}
            <div className="bg-[var(--surface-raised)] p-4 rounded-2xl border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[var(--accent)]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
                    Your True Activity for this Book
                  </h4>
                </div>
                {activity && (
                  <span className="text-[10px] text-[var(--text-dim)] font-mono">
                    Last active:{' '}
                    {new Date(activity.lastInteractedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">
                    <Headphones className="w-3 h-3 text-[var(--accent)]" />
                    <span>True Listened</span>
                  </div>
                  <span className="text-xs sm:text-sm font-bold font-mono text-[var(--text-main)]">
                    {formatTrueDuration(activity?.trueListenedSeconds || 0)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">
                    <BookOpen className="w-3 h-3 text-blue-400" />
                    <span>True Read</span>
                  </div>
                  <span className="text-xs sm:text-sm font-bold font-mono text-[var(--text-main)]">
                    {formatTrueDuration(activity?.trueReadSeconds || 0)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] col-span-2 sm:col-span-1">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Offline Status</span>
                  </div>
                  <span className="text-xs font-medium font-mono text-emerald-400">
                    {downloadSummary.isFullyDownloaded
                      ? 'Full Book Offline (~' + formatBytes(downloadSummary.sizeBytes) + ')'
                      : downloadSummary.isPartiallyDownloaded
                      ? `${downloadSummary.downloadedCount}/${downloadSummary.totalTracks} Chapters Offline`
                      : 'Stream on Demand'}
                  </span>
                </div>
              </div>
            </div>

            {/* Section Switcher Tabs: Synopsis / Chapters / Notes */}
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2 overflow-x-auto scrollbar-none">
              <button
                id="tab-detail-info"
                onClick={() => setActiveTab('info')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'info'
                    ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-md'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface-raised)]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Synopsis</span>
              </button>

              <button
                id="tab-detail-chapters"
                onClick={() => setActiveTab('chapters')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'chapters'
                    ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-md'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface-raised)]'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Chapters ({currentActiveBook.tracks.length})</span>
              </button>

              <button
                id="tab-detail-notes"
                onClick={() => setActiveTab('notes')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'notes'
                    ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-md'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface-raised)]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Notes & Journal</span>
                {bookNotes.length > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      activeTab === 'notes'
                        ? 'bg-black text-[var(--accent)]'
                        : 'bg-[var(--accent)] text-[var(--on-accent)]'
                    }`}
                  >
                    {bookNotes.length}
                  </span>
                )}
              </button>
            </div>

            {/* TAB 1: Synopsis & Description */}
            {activeTab === 'info' && (
              <div id="book-detail-synopsis" className="space-y-4">
                <div className="bg-[var(--surface-raised)] p-4 sm:p-5 rounded-2xl border border-[var(--border-subtle)]">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--accent)] mb-2 font-mono">
                    LibriVox Synopsis
                  </h4>
                  <div className="text-xs sm:text-sm text-[var(--text-main)] font-serif-display italic leading-relaxed whitespace-pre-line">
                    {currentActiveBook.description ||
                      'Classic unabridged recording from the LibriVox volunteer community. In the public domain and available for streaming and offline listening.'}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
                    <span className="text-[10px] text-[var(--text-dim)] uppercase block">Catalog Source</span>
                    <span className="text-xs text-[var(--text-main)] font-medium">LibriVox / IA</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
                    <span className="text-[10px] text-[var(--text-dim)] uppercase block">Total Duration</span>
                    <span className="text-xs text-[var(--text-main)] font-medium font-mono">
                      {formatDuration(currentActiveBook.totalTimeSecs)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-[var(--text-dim)] uppercase block">Copyright</span>
                    <span className="text-xs text-[var(--accent)] font-medium">Public Domain (Free)</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Chapters & Tracks List */}
            {activeTab === 'chapters' && (
              <div id="book-detail-chapters-list" className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 pb-1">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--text-main)]">
                        {currentActiveBook.tracks.length} Continuous Chapters
                      </span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">
                        Deduplicated
                      </span>
                    </div>
                    <span className="text-[11px] text-[var(--text-dim)] block">
                      Click any chapter to play continuously or download below.
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Quality Segment Switcher */}
                    {currentActiveBook.availableQualities && currentActiveBook.availableQualities.length > 1 && (
                      <div className="flex items-center bg-[var(--surface-raised)] p-0.5 rounded-lg border border-[var(--border-subtle)]">
                        {currentActiveBook.availableQualities.map((q) => {
                          const isQActive = (currentActiveBook.selectedQuality || getSavedQualityPreference()) === q;
                          return (
                            <button
                              key={q}
                              onClick={() => {
                                saveQualityPreference(q as AudioQualityPreference);
                                const updated = applyQualityToAudiobook(currentActiveBook, q as AudioQualityPreference);
                                setResolvedBook(updated);
                              }}
                              className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer ${
                                isQActive
                                  ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-sm'
                                  : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'
                              }`}
                            >
                              {q === '128k' ? '128 kbps HQ' : q === '64k' ? '64 kbps' : q.toUpperCase()}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <button
                      onClick={() => setShowChapterDownloadModal(true)}
                      className="text-xs text-[var(--accent)] font-medium hover:underline flex items-center gap-1 shrink-0"
                    >
                      <Download className="w-3 h-3" /> Download
                    </button>
                  </div>
                </div>

                {isLoadingChapters ? (
                  <div className="py-8 text-center space-y-2">
                    <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-[var(--text-dim)]">Fetching complete chapter list from archive...</p>
                  </div>
                ) : (
                  currentActiveBook.tracks.map((track, idx) => {
                    const isTrackActive =
                      isCurrentPlayingBook && playerState.currentTrack?.id === track.id;
                    const isDownloaded = downloadSummary.downloadedTrackIds.includes(track.id);

                    return (
                      <div
                        key={track.id || idx}
                        id={`detail-track-${track.id || idx}`}
                        onClick={() => onPlayBook(currentActiveBook, idx)}
                        className={`flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer border ${
                          isTrackActive
                            ? 'bg-[var(--accent-dim)] border-[var(--accent)] text-[var(--text-main)]'
                            : 'bg-[var(--surface-raised)] border-[var(--border-subtle)] hover:border-[var(--accent)] hover:bg-[var(--surface-raised)] text-[var(--text-main)]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <span className="w-6 text-center text-xs font-mono text-[var(--text-dim)] font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{track.title}</p>
                            <div className="flex items-center gap-2 text-[10px] text-[var(--text-dim)] font-mono mt-0.5">
                              <span>{formatDuration(track.durationSeconds || 1200)}</span>
                              {isDownloaded && (
                                <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Offline Ready
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                              isTrackActive
                                ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-md'
                                : 'bg-[var(--surface-raised)] hover:bg-[var(--accent)] text-[var(--text-main)] hover:text-[var(--on-accent)]'
                            }`}
                            title="Play this track"
                          >
                            {isTrackActive && playerState.isPlaying ? (
                              <Pause className="w-3.5 h-3.5 fill-current" />
                            ) : (
                              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 3: Notes & Journal */}
            {activeTab === 'notes' && (
              <div id="book-detail-notes-list" className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--text-main)]">Reflections & Notes</h4>
                    <p className="text-[10px] text-[var(--text-dim)]">Personal annotations, thoughts, and chapter bookmarks</p>
                  </div>
                  <button
                    onClick={() => setShowNotesModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] text-xs font-semibold shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Take Note</span>
                  </button>
                </div>

                {bookNotes.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-center flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-[var(--surface-raised)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent)] mb-2">
                      <FileText className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-serif-display italic font-medium text-[var(--text-main)]">No notes written for this book yet</p>
                    <p className="text-[10px] text-[var(--text-dim)] mt-1 max-w-[240px] leading-relaxed">
                      Capture quotes, ideas, character notes, or reflections linked to specific chapters and timestamps.
                    </p>
                    <button
                      onClick={() => setShowNotesModal(true)}
                      className="mt-3 px-4 py-2 rounded-xl bg-[var(--accent-dim)] hover:bg-[var(--accent-dim)] text-[var(--accent)] text-xs font-semibold border border-[var(--accent)] transition-all"
                    >
                      Write First Note
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bookNotes.map((note) => (
                      <div
                        key={note.id}
                        className="p-3.5 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] transition-all space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h5 className="text-xs font-serif-display italic font-semibold text-[var(--text-main)]">
                              {note.title}
                            </h5>
                            <div className="flex items-center gap-2 text-[10px] text-[var(--text-dim)] font-mono mt-0.5">
                              <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                              {note.trackTitle && <span>• {note.trackTitle}</span>}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              deleteBookNote(note.id);
                              refreshNotes(currentActiveBook.id);
                            }}
                            className="p-1 rounded-lg text-[var(--text-dim)] hover:text-red-400 hover:bg-[var(--surface-raised)] transition-colors"
                            title="Delete note"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <p className="text-xs text-[var(--text-main)] font-serif-display italic leading-relaxed whitespace-pre-wrap">
                          {note.content}
                        </p>

                        {note.tags && note.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {note.tags.map((t) => (
                              <span
                                key={t}
                                className="px-2 py-0.5 rounded-md bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[9px] text-[var(--accent)] font-mono"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    <div className="pt-2 flex justify-center">
                      <button
                        onClick={() => setShowNotesModal(true)}
                        className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1 font-medium"
                      >
                        Open Full Notes Manager & Export Markdown
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chapter Selection & Download Modal */}
      <ChapterDownloadModal
        isOpen={showChapterDownloadModal}
        book={currentActiveBook}
        onClose={() => setShowChapterDownloadModal(false)}
        onDownloadComplete={() => refreshOfflineState(currentActiveBook)}
      />

      {/* Full Notes Manager Modal */}
      <BookNotesModal
        isOpen={showNotesModal}
        book={currentActiveBook}
        currentTrackTitle={playerState.currentTrack?.title}
        currentTrackIndex={playerState.currentTrackIndex}
        currentTime={playerState.currentTime}
        onClose={() => setShowNotesModal(false)}
      />
    </>
  );
};
