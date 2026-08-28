import React, { useState, useEffect } from 'react';
import { Audiobook, OfflineBookData } from '../types';
import {
  getDownloadedBooks,
  deleteDownloadedBook,
  downloadAudiobook,
  getTotalOfflineStorageUsed,
  formatBytes,
} from '../utils/offlineStorage';
import { Download, Trash2, HardDrive, Wifi, WifiOff, CheckCircle2, RefreshCw, X, Play, BookOpen, AlertCircle, PauseCircle } from 'lucide-react';

interface OfflineManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: Audiobook[];
  isOfflineOnly: boolean;
  onToggleOfflineOnly: () => void;
  onSelectBook: (book: Audiobook) => void;
  onReadBook: (book: Audiobook) => void;
}

export const OfflineManagerModal: React.FC<OfflineManagerModalProps> = ({
  isOpen,
  onClose,
  catalog,
  isOfflineOnly,
  onToggleOfflineOnly,
  onSelectBook,
  onReadBook,
}) => {
  const [downloadedList, setDownloadedList] = useState<OfflineBookData[]>([]);
  const [storageInfo, setStorageInfo] = useState<{ totalBytes: number; bookCount: number }>({
    totalBytes: 0,
    bookCount: 0,
  });
  const [downloadingBookId, setDownloadingBookId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  const [downloadError, setDownloadError] = useState<string | null>(null);

  const loadData = async () => {
    const list = await getDownloadedBooks();
    setDownloadedList(list);
    const info = await getTotalOfflineStorageUsed();
    setStorageInfo(info);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownload = async (book: Audiobook) => {
    setDownloadingBookId(book.id);
    setDownloadProgress(0);
    setDownloadError(null);
    try {
      await downloadAudiobook(book, {
        onProgress: (percent) => {
          setDownloadProgress(percent);
        },
      });
      await loadData();
    } catch (e) {
      console.warn('Download failed:', e);
      setDownloadError(e instanceof Error ? e.message : 'Download failed');
      setTimeout(() => setDownloadError(null), 4000);
    } finally {
      setDownloadingBookId(null);
      setDownloadProgress(0);
    }
  };

  const handleDelete = async (bookId: string) => {
    await deleteDownloadedBook(bookId);
    await loadData();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        id="offline-manager-modal"
        className="w-full max-w-lg rounded-3xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] shadow-2xl p-6 space-y-5 text-[var(--text-main)] animate-in zoom-in-95 max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent-dim)]">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-serif-display font-semibold italic text-[var(--text-main)]">
                Offline Mode & Downloads
              </h3>
              <p className="text-[11px] text-[var(--text-dim)]">Manage local audiobook cache for flight or commute</p>
            </div>
          </div>
          <button
            id="btn-close-offline-modal"
            onClick={onClose}
            className="p-1.5 rounded-full text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface-raised)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Offline Mode Toggle & Storage Summary Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
          {/* Toggle Switch */}
          <div className="p-4 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                {isOfflineOnly ? (
                  <WifiOff className="w-4 h-4 text-amber-400" />
                ) : (
                  <Wifi className="w-4 h-4 text-emerald-400" />
                )}
                <span className="text-xs font-semibold">{isOfflineOnly ? 'Offline Mode Active' : 'Online Mode'}</span>
              </div>
              <p className="text-[10px] text-[var(--text-dim)]">
                {isOfflineOnly ? 'Playing strictly from local storage' : 'Streaming and downloading enabled'}
              </p>
            </div>

            <button
              id="btn-toggle-offline-mode"
              onClick={onToggleOfflineOnly}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                isOfflineOnly ? 'bg-[var(--accent)]' : 'bg-[var(--surface-raised)]'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-black shadow-md transition-transform ${
                  isOfflineOnly ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Storage Footprint */}
          <div className="p-4 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-[var(--text-dim)] tracking-wider">Local Storage Used</span>
              <div className="text-lg font-mono font-bold text-[var(--text-main)]">
                {formatBytes(storageInfo.totalBytes)}
              </div>
              <p className="text-[10px] text-[var(--accent)]">{storageInfo.bookCount} books cached locally</p>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[var(--text-dim)]">
              <Download className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Downloaded Books Section */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
          {/* Download Error Toast */}
          {downloadError && (
            <div className="p-2.5 rounded-xl bg-red-900/40 border border-red-500/30 text-red-200 text-xs text-center flex items-center justify-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{downloadError}</span>
            </div>
          )}

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-2">
              Downloaded Audiobooks ({downloadedList.filter((b) => b.status === 'ready' || b.status === 'partial').length})
            </div>

            {downloadedList.filter((b) => b.status === 'ready' || b.status === 'partial').length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-[var(--border-subtle)] text-center text-[var(--text-dim)] space-y-1">
                <Download className="w-6 h-6 mx-auto opacity-40" />
                <p className="text-xs">No audiobooks saved offline yet.</p>
                <p className="text-[10px] text-[var(--text-dim)]">Download any book below to listen without internet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {downloadedList
                  .filter((b) => b.status === 'ready' || b.status === 'partial')
                  .map((offlineItem) => (
                    <div
                      key={offlineItem.bookId}
                      className="p-3 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-[var(--border-subtle)] bg-black">
                          <img
                            src={offlineItem.book.coverImageUrl}
                            alt={offlineItem.book.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-semibold truncate text-[var(--text-main)]">{offlineItem.book.title}</h4>
                          <div className="flex items-center gap-2 text-[10px] text-[var(--text-dim)]">
                            <span>{formatBytes(offlineItem.sizeBytes)}</span>
                            <span>•</span>
                            {offlineItem.status === 'partial' ? (
                              <span className="text-amber-400 flex items-center gap-1">
                                <PauseCircle className="w-3 h-3" /> Partial
                              </span>
                            ) : (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Ready
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          id={`btn-read-offline-${offlineItem.bookId}`}
                          onClick={() => {
                            onReadBook(offlineItem.book);
                            onClose();
                          }}
                          className="p-2 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--accent-dim)] text-[var(--text-main)] hover:text-[var(--accent)] border border-[var(--border-subtle)]"
                          title="Read Ebook"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`btn-play-offline-${offlineItem.bookId}`}
                          onClick={() => {
                            onSelectBook(offlineItem.book);
                            onClose();
                          }}
                          className="p-2 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] font-semibold shadow-md"
                          title="Play Offline"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                        <button
                          id={`btn-delete-offline-${offlineItem.bookId}`}
                          onClick={() => handleDelete(offlineItem.bookId)}
                          className="p-2 rounded-xl text-[var(--text-dim)] hover:text-red-400 hover:bg-[var(--surface-raised)]"
                          title="Remove from Device"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Quick Download Available Catalog Books */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-2">
              Available to Download for Offline
            </div>
            <div className="space-y-2">
              {catalog.map((book) => {
                const isFullyDownloaded = downloadedList.some((d) => d.bookId === book.id && d.status === 'ready');
                const isPartialDownload = downloadedList.some((d) => d.bookId === book.id && d.status === 'partial');
                const isCurrentDownloading = downloadingBookId === book.id;

                if (isFullyDownloaded) return null; // already shown above

                return (
                  <div
                    key={book.id}
                    className="p-3 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-[var(--border-subtle)] bg-black">
                        <img
                          src={book.coverImageUrl}
                          alt={book.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-semibold truncate text-[var(--text-main)]">{book.title}</h4>
                        <p className="text-[10px] text-[var(--text-dim)] truncate">{book.author} • {book.tracks.length} tracks</p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isCurrentDownloading ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] text-[var(--accent)] text-xs font-mono">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>{downloadProgress}%</span>
                        </div>
                      ) : (
                        <button
                          id={`btn-start-download-${book.id}`}
                          onClick={() => handleDownload(book)}
                          className="px-3 py-1.5 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--accent)] text-[var(--text-main)] hover:text-[var(--on-accent)] border border-[var(--border-subtle)] hover:border-[var(--accent)] text-xs font-semibold flex items-center gap-1.5 transition-all"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{isPartialDownload ? 'Resume' : 'Download'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
