import React, { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Trash2,
  HardDrive,
  Wifi,
  WifiOff,
  CheckCircle2,
  X,
  Pause,
  Play,
  AlertCircle,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { formatBytes } from '../utils/offlineStorage';
import {
  audioDownloadService,
  BookDownloadGroup,
  DownloadedChapterInfo,
} from '../utils/audioDownloadService';

interface OfflineManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOfflineOnly: boolean;
  onToggleOfflineOnly: () => void;
}

const statusLabel = (status: DownloadedChapterInfo['status']): string => {
  switch (status) {
    case 'downloading':
      return 'Downloading';
    case 'paused':
      return 'Paused';
    case 'queued':
      return 'Queued';
    case 'completed':
      return 'Ready';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
};

export const OfflineManagerModal: React.FC<OfflineManagerModalProps> = ({
  isOpen,
  onClose,
  isOfflineOnly,
  onToggleOfflineOnly,
}) => {
  const [groups, setGroups] = useState<BookDownloadGroup[]>([]);
  const [storageInfo, setStorageInfo] = useState({ totalBytes: 0, chapterCount: 0, bookCount: 0 });
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      await audioDownloadService.initialize();
      const [downloads, storage] = await Promise.all([
        audioDownloadService.listDownloads(),
        audioDownloadService.getTotalStorageUsed(),
      ]);
      setGroups(downloads);
      setStorageInfo(storage);
    } catch (e) {
      console.warn('Failed to load downloads:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    loadData();
    const unsubProgress = audioDownloadService.onProgress(() => loadData());
    const unsubState = audioDownloadService.onStateChange((g) => setGroups(g));
    return () => {
      unsubProgress();
      unsubState();
    };
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  const showError = (msg: string) => {
    setActionError(msg);
    setTimeout(() => setActionError(null), 4000);
  };

  const handlePause = async (bookId: string, chapterId: string) => {
    try {
      await audioDownloadService.pauseDownload(bookId, chapterId);
      await loadData();
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Pause failed');
    }
  };

  const handleResume = async (bookId: string, chapterId: string) => {
    try {
      await audioDownloadService.resumeDownload(bookId, chapterId);
      await loadData();
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Resume failed');
    }
  };

  const handleDeleteChapter = async (bookId: string, chapterId: string) => {
    try {
      await audioDownloadService.deleteDownloadedChapter(bookId, chapterId);
      await loadData();
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    try {
      await audioDownloadService.deleteBookDownloads(bookId);
      await loadData();
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        id="offline-manager-modal"
        className="w-full max-w-lg rounded-3xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] shadow-2xl p-6 space-y-5 text-[var(--text-main)] animate-in zoom-in-95 max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent-dim)]">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-serif-display font-semibold italic text-[var(--text-main)]">
                Download Manager
              </h3>
              <p className="text-[11px] text-[var(--text-dim)]">
                Paused, active, and completed chapter downloads
              </p>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
          <div className="p-4 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                {isOfflineOnly ? (
                  <WifiOff className="w-4 h-4 text-amber-400" />
                ) : (
                  <Wifi className="w-4 h-4 text-emerald-400" />
                )}
                <span className="text-xs font-semibold">
                  {isOfflineOnly ? 'Offline Mode Active' : 'Online Mode'}
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-dim)]">
                {isOfflineOnly ? 'Playing from local files only' : 'Streaming and downloading enabled'}
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

          <div className="p-4 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-[var(--text-dim)] tracking-wider">
                Local Storage Used
              </span>
              <div className="text-lg font-mono font-bold text-[var(--text-main)]">
                {formatBytes(storageInfo.totalBytes)}
              </div>
              <p className="text-[10px] text-[var(--accent)]">
                {storageInfo.chapterCount} chapters · {storageInfo.bookCount} books
              </p>
            </div>
            <button
              onClick={loadData}
              className="p-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--accent)]"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
          {actionError && (
            <div className="p-2.5 rounded-xl bg-red-900/40 border border-red-500/30 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {isLoading && groups.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-dim)] text-xs">
              <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2" />
              Loading downloads...
            </div>
          ) : groups.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-[var(--border-subtle)] text-center space-y-2">
              <FolderOpen className="w-8 h-8 mx-auto text-[var(--text-dim)] opacity-50" />
              <p className="text-sm font-medium text-[var(--text-main)]">No downloads yet</p>
              <p className="text-xs text-[var(--text-dim)] max-w-xs mx-auto leading-relaxed">
                Open any audiobook from Explore or Search, then use{' '}
                <strong className="text-[var(--accent)]">Download Chapters</strong> to save episodes
                for offline listening.
              </p>
            </div>
          ) : (
            groups.map((group) => {
              const isExpanded = expandedBookId === group.bookId;
              return (
                <div
                  key={group.bookId}
                  className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedBookId(isExpanded ? null : group.bookId)}
                    className="w-full p-3.5 flex items-center justify-between gap-3 text-left hover:bg-[var(--surface)] transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold truncate">{group.bookTitle}</h4>
                      <p className="text-[10px] text-[var(--text-dim)] mt-0.5">
                        {group.completedCount}/{group.chapters.length} ready · {formatBytes(group.totalBytes)}
                        {group.activeCount > 0 && (
                          <span className="text-[var(--accent)]"> · {group.activeCount} active</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBook(group.bookId);
                        }}
                        className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10"
                        title="Delete all chapters for this book"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
                      {group.chapters.map((ch) => (
                        <div key={ch.chapterId} className="p-3 flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{ch.chapterTitle}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={`text-[9px] font-bold uppercase tracking-wider ${
                                  ch.status === 'completed'
                                    ? 'text-emerald-400'
                                    : ch.status === 'failed'
                                    ? 'text-red-400'
                                    : ch.status === 'paused'
                                    ? 'text-amber-400'
                                    : 'text-[var(--accent)]'
                                }`}
                              >
                                {statusLabel(ch.status)}
                              </span>
                              {ch.status === 'downloading' || ch.status === 'paused' ? (
                                <span className="text-[10px] font-mono text-[var(--text-dim)]">
                                  {ch.percent}%
                                </span>
                              ) : ch.isOnDisk ? (
                                <span className="text-[10px] text-[var(--text-dim)]">
                                  {formatBytes(ch.fileSizeBytes)}
                                </span>
                              ) : null}
                            </div>
                            {(ch.status === 'downloading' || ch.status === 'paused') && (
                              <div className="mt-1.5 h-1 bg-[var(--surface)] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[var(--accent)] transition-all"
                                  style={{ width: `${Math.max(2, ch.percent)}%` }}
                                />
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {ch.status === 'downloading' && (
                              <button
                                onClick={() => handlePause(ch.bookId, ch.chapterId)}
                                className="p-1.5 rounded-lg bg-[var(--surface)] hover:bg-amber-500/20 text-amber-400"
                                title="Pause download"
                              >
                                <Pause className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {(ch.status === 'paused' || ch.status === 'failed') && ch.remoteUrl && (
                              <button
                                onClick={() => handleResume(ch.bookId, ch.chapterId)}
                                className="p-1.5 rounded-lg bg-[var(--accent-dim)] text-[var(--accent)]"
                                title="Resume download"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </button>
                            )}
                            {(ch.isOnDisk || ch.status === 'paused' || ch.status === 'failed') && (
                              <button
                                onClick={() => handleDeleteChapter(ch.bookId, ch.chapterId)}
                                className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10"
                                title="Delete downloaded file"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {ch.status === 'completed' && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <p className="text-[10px] text-center text-[var(--text-dim)] shrink-0">
          Files stored at <code className="text-[var(--accent)]">audiobooks/&#123;book_id&#125;/&#123;chapter_id&#125;.mp3</code>
        </p>
      </div>
    </div>
  );
};
