import React, { useState, useEffect } from 'react';
import {
  Audiobook,
  Bookmark as BookmarkType,
  OfflineBookData,
  BookNote,
  OfflineEbookData,
  ReadingSessionRecord,
} from '../types';
import {
  Bookmark,
  Play,
  Trash2,
  BookOpen,
  HardDrive,
  Download,
  WifiOff,
  FileText,
  Copy,
  Check,
  Search,
  Tag,
  Clock,
  CheckCircle2,
  History as HistoryIcon,
  Sparkles,
} from 'lucide-react';
import {
  formatBytes,
  getBookDownloadSummary,
  getAllOfflineEbooks,
  deleteOfflineEbook,
  deleteDownloadedBook,
} from '../utils/offlineStorage';
import { getAllBookNotes, deleteBookNote, exportBookNotesAsMarkdown } from '../utils/notesStorage';
import {
  getReadingSessions,
  clearReadingHistory,
  formatTrueDuration,
} from '../utils/activityTracker';
import {
  CoverSyncBadge,
  InlineSyncBadge,
  SyncLegendBar,
  getBookSyncStatus,
} from './SyncStatusBadge';

interface LibraryViewProps {
  history: Audiobook[];
  savedBooks: Audiobook[];
  offlineBooks: OfflineBookData[];
  bookmarks: BookmarkType[];
  currentBook?: Audiobook | null;
  isPlaying?: boolean;
  onSelectBook: (book: Audiobook) => void;
  onReadBook?: (book: Audiobook) => void;
  onClearHistory: () => void;
  onDeleteBookmark: (id: string) => void;
  onJumpToBookmark: (bm: BookmarkType) => void;
  onOpenOfflineManager: () => void;
  onUploadEpub?: (book: Audiobook) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  history,
  savedBooks,
  offlineBooks,
  bookmarks,
  currentBook = null,
  isPlaying = false,
  onSelectBook,
  onReadBook,
  onClearHistory,
  onDeleteBookmark,
  onJumpToBookmark,
  onOpenOfflineManager,
}) => {
  const [tab, setTab] = useState<'reading' | 'read' | 'unread' | 'offline' | 'history' | 'bookmarks'>('reading');
  const [historySubTab, setHistorySubTab] = useState<'reading' | 'audio'>('reading');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [offlineSubTab, setOfflineSubTab] = useState<'audiobooks' | 'ebooks'>('audiobooks');
  const [offlineEbooks, setOfflineEbooks] = useState<any[]>([]);
  const [readingSessions, setReadingSessions] = useState<any[]>([]);

  const toggleSelect = (bookId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(bookId)) {
      newSelected.delete(bookId);
    } else {
      newSelected.add(bookId);
    }
    setSelectedIds(newSelected);
  };

  const deleteSelected = async () => {
    await Promise.all(Array.from(selectedIds).map((id) => deleteDownloadedBook(String(id))));
    setSelectedIds(new Set());
    setIsSelectMode(false);
    refreshOfflineEbooks();
  };

  // Function to sort books by last visited time
  const sortByLastVisited = (books: Audiobook[]) => {
    return [...books].sort((a, b) => (b.lastVisited || 0) - (a.lastVisited || 0));
  };

  // Logic to categorize books
  const allBooks = Array.from(
    new Map([...savedBooks, ...history, ...offlineBooks.map((o) => o.book)].map((b) => [b.id, b])).values()
  );

  const readingBooks = sortByLastVisited(allBooks.filter(b => b.status === 'reading'));
  const readBooks = sortByLastVisited(allBooks.filter(b => b.status === 'read'));
  const unreadBooks = sortByLastVisited(allBooks.filter(b => !b.status || b.status === 'unread'));
  const [allNotes, setAllNotes] = useState<BookNote[]>([]);
  const [notesSearch, setNotesSearch] = useState('');
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [downloadSummaries, setDownloadSummaries] = useState<
    Record<
      string,
      {
        isFullyDownloaded: boolean;
        isPartiallyDownloaded: boolean;
        downloadedCount: number;
        totalTracks: number;
      }
    >
  >({});

  const readyOffline = offlineBooks.filter((b) => b.status === 'ready');

  const refreshOfflineEbooks = async () => {
    try {
      const ebooks = await getAllOfflineEbooks();
      setOfflineEbooks(ebooks);
    } catch (e) {
      console.warn('Failed to load offline ebooks in LibraryView', e);
    }
  };

  const refreshReadingSessions = () => {
    setReadingSessions(getReadingSessions());
  };

  const refreshAllNotes = () => {
    setAllNotes(getAllBookNotes());
  };

  useEffect(() => {
    refreshAllNotes();
    refreshOfflineEbooks();
    refreshReadingSessions();

    const handleNotesChange = () => refreshAllNotes();
    const handleEbooksChange = () => refreshOfflineEbooks();
    const handleReadingChange = () => refreshReadingSessions();

    window.addEventListener('libriaudio_notes_updated', handleNotesChange);
    window.addEventListener('libriaudio_ebooks_updated', handleEbooksChange);
    window.addEventListener('libriaudio_reading_updated', handleReadingChange);

    return () => {
      window.removeEventListener('libriaudio_notes_updated', handleNotesChange);
      window.removeEventListener('libriaudio_ebooks_updated', handleEbooksChange);
      window.removeEventListener('libriaudio_reading_updated', handleReadingChange);
    };
  }, []);

  const handleDeleteEbook = async (bookId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteOfflineEbook(bookId);
    await refreshOfflineEbooks();
  };

  const handleClearReadingLog = () => {
    clearReadingHistory();
    refreshReadingSessions();
  };

  // Asynchronously query exact download track breakdown for all books in library
  useEffect(() => {
    let isMounted = true;

    const loadSummaries = async () => {
      const allUniqueBooks = Array.from(
        new Map(
          [...savedBooks, ...history, ...offlineBooks.map((o) => o.book)].map((b) => [b.id, b])
        ).values()
      );

      const summaries: Record<
        string,
        {
          isFullyDownloaded: boolean;
          isPartiallyDownloaded: boolean;
          downloadedCount: number;
          totalTracks: number;
        }
      > = {};

      for (const book of allUniqueBooks) {
        try {
          const summary = await getBookDownloadSummary(book);
          summaries[book.id] = summary;
        } catch {
          // ignore
        }
      }

      if (isMounted) {
        setDownloadSummaries(summaries);
      }
    };

    loadSummaries();

    return () => {
      isMounted = false;
    };
  }, [savedBooks, history, offlineBooks]);

  // Overall sync stats across active library collections
  const allLibraryBooks = Array.from(
    new Map(
      [...savedBooks, ...history, ...offlineBooks.map((o) => o.book)].map((b) => [b.id, b])
    ).values()
  );

  const syncStats = allLibraryBooks.reduce(
    (acc, b) => {
      const info = getBookSyncStatus(
        b,
        offlineBooks,
        currentBook,
        isPlaying,
        downloadSummaries[b.id]
      );
      acc[info.status]++;
      return acc;
    },
    { cached: 0, partial: 0, streaming: 0, cloud: 0 }
  );

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div id="library-view-container" className="w-full pb-16 text-[#EFEFEF]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-serif-display italic font-bold text-white tracking-wide">
            Your Library
          </h1>
          <p className="text-xs text-white/50 font-serif-display italic mt-0.5">
            Saved audiobooks and offline sync storage
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Download Manager Launcher */}
          <button
            id="btn-open-storage-manager"
            onClick={onOpenOfflineManager}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-[#C5A059]/15 border border-white/10 hover:border-[#C5A059]/40 text-xs text-white/80 hover:text-[#C5A059] font-medium transition-all shadow-sm active:scale-95"
            title="Open Offline Download Manager"
          >
            <HardDrive className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Download Manager</span>
            {readyOffline.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-[#C5A059] text-black text-[10px] font-mono font-bold">
                {readyOffline.length}
              </span>
            )}
          </button>
        </div>
      </div>



      {/* Sync Status Legend Bar */}
      <SyncLegendBar stats={syncStats} />

      {/* Library Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.03] border border-white/10 mb-4 overflow-x-auto scrollbar-none">
        <button
          id="tab-library-reading"
          onClick={() => setTab('reading')}
          className={`flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap ${
            tab === 'reading'
              ? 'bg-[#C5A059] text-black shadow-md'
              : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          Reading ({readingBooks.length})
        </button>
        <button
          id="tab-library-read"
          onClick={() => setTab('read')}
          className={`flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap ${
            tab === 'read'
              ? 'bg-[#C5A059] text-black shadow-md'
              : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          Read ({readBooks.length})
        </button>
        <button
          id="tab-library-unread"
          onClick={() => setTab('unread')}
          className={`flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap ${
            tab === 'unread'
              ? 'bg-[#C5A059] text-black shadow-md'
              : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          Unread ({unreadBooks.length})
        </button>
        <button
          id="tab-library-offline"
          onClick={() => setTab('offline')}
          className={`flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap ${
            tab === 'offline'
              ? 'bg-[#C5A059] text-black shadow-md'
              : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          Offline
        </button>
        <button
          id="tab-library-history"
          onClick={() => setTab('history')}
          className={`flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap ${
            tab === 'history'
              ? 'bg-[#C5A059] text-black shadow-md'
              : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          History ({readingSessions.length + history.length})
        </button>
        <button
          id="tab-library-bookmarks"
          onClick={() => setTab('bookmarks')}
          className={`flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap ${
            tab === 'bookmarks'
              ? 'bg-[#C5A059] text-black shadow-md'
              : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          Notes & Journal ({allNotes.length + bookmarks.length})
        </button>
      </div>

      {/* TAB: Reading Books */}
      {tab === 'reading' && (
        <div id="library-reading-section" className="space-y-2">
          {readingBooks.map((book) => (
            <div
              key={`reading-${book.id}`}
              onClick={() => onSelectBook(book)}
              className="flex items-center gap-3 p-2.5 rounded-2xl bg-[#111111]/90 border border-white/[0.07] hover:border-[#C5A059]/40 hover:bg-[#161616] transition-all cursor-pointer"
            >
              <img src={book.coverImageUrl} alt={book.title} className="w-12 h-16 rounded-lg object-cover" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">{book.title}</h4>
                <p className="text-xs text-white/60">{book.author}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB: Read Books */}
      {tab === 'read' && (
        <div id="library-read-section" className="space-y-2">
          {readBooks.map((book) => (
            <div
              key={`read-${book.id}`}
              onClick={() => onSelectBook(book)}
              className="flex items-center gap-3 p-2.5 rounded-2xl bg-[#111111]/90 border border-white/[0.07] hover:border-[#C5A059]/40 hover:bg-[#161616] transition-all cursor-pointer"
            >
              <img src={book.coverImageUrl} alt={book.title} className="w-12 h-16 rounded-lg object-cover" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">{book.title}</h4>
                <p className="text-xs text-white/60">{book.author}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB: Unread Books */}
      {tab === 'unread' && (
        <div id="library-unread-section" className="space-y-2">
          {unreadBooks.map((book) => (
            <div
              key={`unread-${book.id}`}
              onClick={() => onSelectBook(book)}
              className="flex items-center gap-3 p-2.5 rounded-2xl bg-[#111111]/90 border border-white/[0.07] hover:border-[#C5A059]/40 hover:bg-[#161616] transition-all cursor-pointer"
            >
              <img src={book.coverImageUrl} alt={book.title} className="w-12 h-16 rounded-lg object-cover" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">{book.title}</h4>
                <p className="text-xs text-white/60">{book.author}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: Downloaded Offline (Audiobooks & Stored Ebooks) */}
      {tab === 'offline' && (
        <div id="library-offline-section" className="space-y-3">
          {/* Sub-selector for Offline Audio vs Stored Ebooks */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <button
              onClick={() => setOfflineSubTab('audiobooks')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                offlineSubTab === 'audiobooks'
                  ? 'bg-white/15 text-white border border-white/20'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Audiobooks ({readyOffline.length})
            </button>
            <button
              onClick={() => setOfflineSubTab('ebooks')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                offlineSubTab === 'ebooks'
                  ? 'bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/30'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <HardDrive className="w-3 h-3" />
              <span>Stored Ebooks ({offlineEbooks.length})</span>
            </button>
          </div>

          {offlineSubTab === 'audiobooks' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2">
                <button
                  onClick={() => {
                    setIsSelectMode(!isSelectMode);
                    setSelectedIds(new Set());
                  }}
                  className="text-xs text-white/60 hover:text-white"
                >
                  {isSelectMode ? 'Cancel' : 'Select'}
                </button>
                {isSelectMode && selectedIds.size > 0 && (
                  <button
                    onClick={deleteSelected}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
                  >
                    Delete {selectedIds.size} Selected
                  </button>
                )}
              </div>
              {readyOffline.length === 0 ? (
                <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center text-[#C5A059] mb-2">
                    <Download className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-serif-display italic font-medium text-white/70">No audiobooks saved offline</p>
                  <p className="text-[10px] text-white/40 mt-1 max-w-[220px] leading-relaxed">
                    Download audiobooks to listen offline during flights or commutes.
                  </p>
                  <button
                    onClick={onOpenOfflineManager}
                    className="mt-3 px-3 py-1.5 rounded-xl bg-[#C5A059] text-black text-xs font-semibold"
                  >
                    Open Download Manager
                  </button>
                </div>
              ) : (
                readyOffline.map((item) => {
                  const syncInfo = getBookSyncStatus(
                    item.book,
                    offlineBooks,
                    currentBook,
                    isPlaying,
                    downloadSummaries[item.bookId] || {
                      isFullyDownloaded: true,
                      isPartiallyDownloaded: false,
                      downloadedCount: item.book.tracks?.length || 1,
                      totalTracks: item.book.tracks?.length || 1,
                    }
                  );

                  return (
                    <div
                      key={`offline-${item.bookId}`}
                      id={`offline-item-${item.bookId}`}
                      onClick={() => isSelectMode ? toggleSelect(item.bookId) : onSelectBook(item.book)}
                      className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-all cursor-pointer group ${
                        isSelectMode && selectedIds.has(item.bookId) 
                          ? 'bg-[#C5A059]/10 border-[#C5A059]' 
                          : 'bg-[#111111]/90 border-white/[0.07] hover:border-[#C5A059]/40 hover:bg-[#161616]'
                      }`}
                    >
                      {isSelectMode && (
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedIds.has(item.bookId) ? 'bg-[#C5A059] border-[#C5A059]' : 'border-white/20'}`}>
                          {selectedIds.has(item.bookId) && <Check className="w-3 h-3 text-black" />}
                        </div>
                      )}
                      {/* Book Cover with Visual Sync Status Overlay Badge */}
                      <div className="relative shrink-0 w-12 h-16 sm:w-14 sm:h-20 rounded-xl overflow-hidden bg-[#1a1a1a] border border-white/10 shadow-sm group-hover:border-[#C5A059]/40 transition-colors">
                        <img
                          src={item.book.coverImageUrl}
                          alt={item.book.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <CoverSyncBadge syncInfo={syncInfo} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h4 className="text-xs sm:text-sm font-serif-display italic font-medium text-[#EFEFEF] truncate group-hover:text-[#C5A059] transition-colors">
                            {item.book.title}
                          </h4>
                          <InlineSyncBadge syncInfo={syncInfo} />
                        </div>
                        <p className="text-[11px] text-[#888888] font-serif-display italic truncate">
                          {item.book.author} • {formatBytes(item.sizeBytes)}
                        </p>
                        <p className="text-[10px] text-emerald-400/80 font-mono mt-0.5 truncate">
                          100% Offline Ready • {item.book.tracks?.length || 1} tracks stored
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {onReadBook && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onReadBook(item.book);
                            }}
                            className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-[#C5A059]/20 text-white/50 hover:text-[#C5A059] flex items-center justify-center transition-all border border-white/10"
                            title="Read Ebook Text"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          className="w-8 h-8 rounded-xl bg-[#C5A059] text-black flex items-center justify-center transition-all shadow-md"
                          title="Play Cached Audio"
                        >
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {offlineSubTab === 'ebooks' && (
            <div className="space-y-2">
              {offlineEbooks.length === 0 ? (
                <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center text-[#C5A059] mb-2">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-serif-display italic font-medium text-white/70">No ebooks saved on device yet</p>
                  <p className="text-[10px] text-white/40 mt-1 max-w-[240px] leading-relaxed">
                    Whenever you open or read any book in the reader, its full text manuscript and chapters are automatically saved locally on your device for instant offline reading!
                  </p>
                </div>
              ) : (
                offlineEbooks.map((ebook) => {
                  const reconstructedBook: Audiobook = {
                    id: ebook.bookId,
                    title: ebook.title,
                    author: ebook.author,
                    description: '',
                    coverImageUrl: ebook.coverImageUrl,
                    language: 'en',
                    totalTimeSecs: 1800,
                    tracks: [],
                    ebookChapters: ebook.chapters,
                  };

                  return (
                    <div
                      key={`stored-ebook-${ebook.bookId}`}
                      id={`stored-ebook-${ebook.bookId}`}
                      onClick={() => onReadBook && onReadBook(reconstructedBook)}
                      className="flex items-center gap-3 p-2.5 rounded-2xl bg-[#111111]/90 border border-white/[0.07] hover:border-[#C5A059]/40 hover:bg-[#161616] transition-all cursor-pointer group"
                    >
                      <div className="relative shrink-0 w-12 h-16 sm:w-14 sm:h-20 rounded-xl overflow-hidden bg-[#1a1a1a] border border-white/10 shadow-sm group-hover:border-[#C5A059]/40 transition-colors">
                        <img
                          src={ebook.coverImageUrl}
                          alt={ebook.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-1 right-1 p-1 rounded-full bg-emerald-500/80 text-black">
                          <HardDrive className="w-2.5 h-2.5" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h4 className="text-xs sm:text-sm font-serif-display italic font-medium text-[#EFEFEF] truncate group-hover:text-[#C5A059] transition-colors">
                            {ebook.title}
                          </h4>
                          <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] font-mono">
                            On Device
                          </span>
                        </div>
                        <p className="text-[11px] text-[#888888] font-serif-display italic truncate">
                          {ebook.author} • {formatBytes(ebook.sizeBytes)}
                        </p>
                        <p className="text-[10px] text-[#C5A059] font-mono mt-0.5 truncate">
                          {ebook.chapters?.length || 1} chapters • Last read Ch. {(ebook.lastReadChapterIndex || 0) + 1} ({ebook.lastScrollPercentage || 0}%)
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {onReadBook && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onReadBook(reconstructedBook);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#C5A059] hover:bg-[#d4af65] text-black text-xs font-semibold flex items-center gap-1 shadow-md transition-all"
                            title="Read Offline Ebook"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Read</span>
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDeleteEbook(ebook.bookId, e)}
                          className="p-2 rounded-xl text-white/30 hover:text-rose-400 hover:bg-white/5 transition-colors"
                          title="Remove from Device"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: History (Reading Log & Audiobook Playback History) */}
      {tab === 'history' && (
        <div id="library-history-section" className="space-y-3">
          {/* Sub-selector for Reading Log vs Audio Playback History */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHistorySubTab('reading')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  historySubTab === 'reading'
                    ? 'bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/30'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <BookOpen className="w-3 h-3" />
                <span>Reading Log ({readingSessions.length})</span>
              </button>
              <button
                onClick={() => setHistorySubTab('audio')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  historySubTab === 'audio'
                    ? 'bg-white/15 text-white border border-white/20'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Audio History ({history.length})</span>
              </button>
            </div>

            {historySubTab === 'reading' && readingSessions.length > 0 && (
              <button
                id="btn-clear-reading-log"
                onClick={handleClearReadingLog}
                className="text-[10px] uppercase tracking-wider text-white/40 hover:text-rose-400 flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Clear Log
              </button>
            )}

            {historySubTab === 'audio' && history.length > 0 && (
              <button
                id="btn-clear-history"
                onClick={onClearHistory}
                className="text-[10px] uppercase tracking-wider text-white/40 hover:text-rose-400 flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Clear History
              </button>
            )}
          </div>

          {/* Reading Sessions History Log */}
          {historySubTab === 'reading' && (
            <div className="space-y-2">
              {readingSessions.length === 0 ? (
                <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center">
                  <p className="text-xs font-serif-display italic text-white/50">No reading sessions recorded yet.</p>
                  <p className="text-[10px] text-white/30 mt-0.5">
                    Open any ebook to start reading. Your reading time, chapters, and dates will be tracked automatically here.
                  </p>
                </div>
              ) : (
                readingSessions.map((session) => {
                  const reconstructedBook: Audiobook = {
                    id: session.bookId,
                    title: session.bookTitle,
                    author: session.bookAuthor,
                    description: '',
                    coverImageUrl: session.coverImageUrl,
                    language: 'en',
                    totalTimeSecs: 1800,
                    tracks: [],
                  };

                  const formattedDate = new Date(session.endTimestamp).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={session.id}
                      id={`reading-session-${session.id}`}
                      className="flex items-center gap-3 p-2.5 rounded-2xl bg-[#111111]/90 border border-white/[0.07] hover:border-[#C5A059]/40 hover:bg-[#161616] transition-all group"
                    >
                      <div className="relative shrink-0 w-12 h-16 sm:w-14 sm:h-20 rounded-xl overflow-hidden bg-[#1a1a1a] border border-white/10 shadow-sm group-hover:border-[#C5A059]/40 transition-colors">
                        <img
                          src={session.coverImageUrl}
                          alt={session.bookTitle}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h4 className="text-xs sm:text-sm font-serif-display italic font-medium text-[#EFEFEF] truncate group-hover:text-[#C5A059] transition-colors">
                            {session.bookTitle}
                          </h4>
                        </div>
                        <p className="text-[11px] text-[#888888] font-serif-display italic truncate">
                          {session.bookAuthor} • <span className="text-[#C5A059]">{session.chapterTitle}</span>
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-white/50 font-mono mt-0.5">
                          <span className="text-[#C5A059] font-semibold flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            Read for {formatTrueDuration(session.durationSeconds)}
                          </span>
                          <span>•</span>
                          <span>{formattedDate}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {onReadBook && (
                          <button
                            onClick={() => onReadBook(reconstructedBook)}
                            className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-[#C5A059] text-white hover:text-black border border-white/10 hover:border-[#C5A059] text-xs font-semibold flex items-center gap-1 transition-all"
                            title="Resume Reading Ebook"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Resume</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Audio Playback History */}
          {historySubTab === 'audio' && (
            <div className="space-y-2">
              {history.length === 0 ? (
                <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center">
                  <p className="text-xs font-serif-display italic text-white/50">No recently played audiobooks yet.</p>
                  <p className="text-[10px] text-white/30 mt-0.5">Start listening from Explore to populate your history.</p>
                </div>
              ) : (
                history.map((book) => {
                  const syncInfo = getBookSyncStatus(
                    book,
                    offlineBooks,
                    currentBook,
                    isPlaying,
                    downloadSummaries[book.id]
                  );

                  return (
                    <div
                      key={`history-${book.id}`}
                      id={`history-item-${book.id}`}
                      onClick={() => onSelectBook(book)}
                      className="flex items-center gap-3 p-2.5 rounded-2xl bg-[#111111]/90 border border-white/[0.07] hover:border-[#C5A059]/40 hover:bg-[#161616] transition-all cursor-pointer group"
                    >
                      {/* Book Cover with Visual Sync Status Overlay Badge */}
                      <div className="relative shrink-0 w-12 h-16 sm:w-14 sm:h-20 rounded-xl overflow-hidden bg-[#1a1a1a] border border-white/10 shadow-sm group-hover:border-[#C5A059]/40 transition-colors">
                        <img
                          src={book.coverImageUrl}
                          alt={book.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <CoverSyncBadge syncInfo={syncInfo} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h4 className="text-xs sm:text-sm font-serif-display italic font-medium text-[#EFEFEF] truncate group-hover:text-[#C5A059] transition-colors">
                            {book.title}
                          </h4>
                          <InlineSyncBadge syncInfo={syncInfo} />
                        </div>
                        <p className="text-[11px] text-[#888888] font-serif-display italic truncate">
                          {book.author} • {book.tracks?.length || 1} chapters
                        </p>
                        <p className="text-[10px] text-white/40 font-mono mt-0.5 truncate">
                          {syncInfo.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {onReadBook && (
                          <button
                            id={`btn-read-history-${book.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onReadBook(book);
                            }}
                            className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-[#C5A059]/20 text-white/50 hover:text-[#C5A059] flex items-center justify-center transition-all border border-white/10 hover:border-[#C5A059]/40"
                            title="Read Ebook Text"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          id={`btn-resume-history-${book.id}`}
                          className="w-8 h-8 rounded-xl bg-white/[0.05] group-hover:bg-[#C5A059] text-white/60 group-hover:text-black flex items-center justify-center transition-all border border-white/10 group-hover:border-[#C5A059]"
                          title="Play Audio"
                        >
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Book Notes, Reflections & Timestamp Bookmarks */}
      {tab === 'bookmarks' && (
        <div id="library-bookmarks-section" className="space-y-4">
          {/* Notes Search & Export Toolbar */}
          {(allNotes.length > 0 || bookmarks.length > 0) && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2 rounded-2xl bg-white/[0.03] border border-white/10">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  value={notesSearch}
                  onChange={(e) => setNotesSearch(e.target.value)}
                  placeholder="Search book notes, tags, quotes..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#C5A059]/50"
                />
              </div>
              {allNotes.length > 0 && (
                <button
                  onClick={() => {
                    const md = exportBookNotesAsMarkdown(allNotes);
                    navigator.clipboard.writeText(md);
                    setCopiedMarkdown(true);
                    setTimeout(() => setCopiedMarkdown(false), 2000);
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-[#C5A059]/15 border border-white/10 text-xs text-white/80 hover:text-[#C5A059] transition-all whitespace-nowrap cursor-pointer"
                >
                  {copiedMarkdown ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied Markdown!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Export All Notes (.md)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* SECTION A: Written Book Notes & Reflections */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#C5A059] flex items-center gap-1.5">
                <FileText className="w-3 h-3" /> Book Notes & Reflections ({allNotes.length})
              </span>
            </div>

            {allNotes.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center flex flex-col items-center">
                <p className="text-xs font-serif-display italic font-medium text-white/70">No written notes yet</p>
                <p className="text-[10px] text-white/40 mt-1 max-w-[240px] leading-relaxed">
                  Open any book or player and tap &ldquo;Notes&rdquo; to write reflections, chapter summaries, or ideas.
                </p>
              </div>
            ) : (
              allNotes
                .filter((n) => {
                  if (!notesSearch.trim()) return true;
                  const q = notesSearch.toLowerCase();
                  return (
                    n.title.toLowerCase().includes(q) ||
                    n.content.toLowerCase().includes(q) ||
                    n.bookTitle.toLowerCase().includes(q) ||
                    n.tags.some((t) => t.toLowerCase().includes(q))
                  );
                })
                .map((note) => (
                  <div
                    key={note.id}
                    className="p-3.5 rounded-2xl bg-[#111111]/90 border border-white/[0.07] hover:border-white/15 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs font-serif-display italic font-semibold text-white">
                            {note.title}
                          </h5>
                          <span className="text-[10px] text-[#C5A059] font-serif-display italic">
                            — {note.bookTitle}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono mt-0.5">
                          <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                          {note.trackTitle && <span>• {note.trackTitle}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          deleteBookNote(note.id);
                          refreshAllNotes();
                        }}
                        className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-white/5 transition-colors shrink-0"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-white/80 font-serif-display italic leading-relaxed whitespace-pre-wrap">
                      {note.content}
                    </p>

                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {note.tags.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/5 text-[9px] text-[#C5A059] font-mono"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>

          {/* SECTION B: Audio Timestamp Bookmarks */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                <Bookmark className="w-3 h-3 text-[#C5A059]" /> Audio Timestamp Bookmarks ({bookmarks.length})
              </span>
            </div>

            {bookmarks.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center flex flex-col items-center">
                <p className="text-xs font-serif-display italic font-medium text-white/70">No audio bookmarks yet</p>
                <p className="text-[10px] text-white/40 mt-1 max-w-[220px] leading-relaxed">
                  Drop bookmarks while listening to save memorable quotes or timestamps.
                </p>
              </div>
            ) : (
              bookmarks.map((bm) => (
                <div
                  key={bm.id}
                  className="p-3 rounded-2xl bg-[#111111]/90 border border-white/[0.07] hover:border-[#C5A059]/40 transition-all flex items-start justify-between gap-3 group"
                >
                  <button
                    onClick={() => onJumpToBookmark(bm)}
                    className="flex-1 text-left flex items-start gap-3 min-w-0"
                  >
                    <div className="p-2 rounded-xl bg-[#C5A059]/10 text-[#C5A059] group-hover:bg-[#C5A059] group-hover:text-black transition-colors shrink-0 mt-0.5">
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[#E8E8E8]">{formatTime(bm.timestamp)}</span>
                        <span className="text-[10px] text-[#C5A059] font-serif-display italic truncate">{bm.bookTitle}</span>
                      </div>
                      <p className="text-[10px] text-white/40 truncate">{bm.trackTitle}</p>
                      {bm.note && (
                        <p className="text-xs text-white/80 font-serif-display italic leading-relaxed pt-0.5">
                          &ldquo;{bm.note}&rdquo;
                        </p>
                      )}
                    </div>
                  </button>

                  <button
                    onClick={() => onDeleteBookmark(bm.id)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-white/5 transition-colors shrink-0"
                    title="Delete Bookmark"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};


