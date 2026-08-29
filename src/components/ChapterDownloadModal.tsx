import React, { useState, useEffect, useCallback } from 'react';
import { Audiobook, AudioTrack } from '../types';
import {
  X,
  Download,
  Check,
  Trash2,
  CheckCircle2,
  Pause,
  Play,
  RefreshCw,
} from 'lucide-react';
import { formatBytes } from '../utils/offlineStorage';
import { resolveFullTracklist } from '../utils/librivoxRecommendations';
import {
  audioDownloadService,
  DownloadedChapterInfo,
} from '../utils/audioDownloadService';

interface ChapterDownloadModalProps {
  isOpen: boolean;
  book: Audiobook;
  onClose: () => void;
  onDownloadComplete?: () => void;
}

export const ChapterDownloadModal: React.FC<ChapterDownloadModalProps> = ({
  isOpen,
  book,
  onClose,
  onDownloadComplete,
}) => {
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [chapterStates, setChapterStates] = useState<Record<string, DownloadedChapterInfo>>({});
  const [isResolvingTracks, setIsResolvingTracks] = useState(true);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const resolveTracks = useCallback(async () => {
    setIsResolvingTracks(true);
    setResolveError(null);
    try {
      await audioDownloadService.initialize();
      const groups = await audioDownloadService.listDownloads();
      const bookGroup = groups.find((g) => g.bookId === book.id);
      const map: Record<string, DownloadedChapterInfo> = {};
      bookGroup?.chapters.forEach((ch) => {
        map[ch.chapterId] = ch;
      });
      setChapterStates(map);

      let resolved = book;
      if (!book.tracks || book.tracks.length <= 1) {
        resolved = await resolveFullTracklist(book);
      }
      const list = resolved.tracks && resolved.tracks.length > 0 ? resolved.tracks : [];
      if (list.length === 0) {
        setResolveError('No chapters found for this audiobook.');
      }
      setTracks(list);
      const notDownloaded = list
        .filter((t) => !map[t.id] || map[t.id].status !== 'completed')
        .map((t) => t.id);
      setSelectedTrackIds(notDownloaded.length > 0 ? notDownloaded : list.map((t) => t.id));
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : 'Could not load chapter list.');
      setTracks([]);
    } finally {
      setIsResolvingTracks(false);
    }
  }, [book]);

  const refreshChapterStates = useCallback(async () => {
    try {
      const groups = await audioDownloadService.listDownloads();
      const bookGroup = groups.find((g) => g.bookId === book.id);
      const map: Record<string, DownloadedChapterInfo> = {};
      bookGroup?.chapters.forEach((ch) => {
        map[ch.chapterId] = ch;
      });
      setChapterStates(map);
    } catch {
      setChapterStates({});
    }
  }, [book.id]);

  useEffect(() => {
    if (!isOpen) return;
    resolveTracks();
    const unsub = audioDownloadService.onProgress((p) => {
      if (p.bookId === book.id) refreshChapterStates();
    });
    return unsub;
  }, [isOpen, book.id, resolveTracks, refreshChapterStates]);

  if (!isOpen) return null;

  const toggleSelectTrack = (trackId: string) => {
    setSelectedTrackIds((prev) =>
      prev.includes(trackId) ? prev.filter((id) => id !== trackId) : [...prev, trackId],
    );
  };

  const selectAll = () => setSelectedTrackIds(tracks.map((t) => t.id));
  const selectNextN = (count: number) => {
    const pending = tracks.filter((t) => chapterStates[t.id]?.status !== 'completed');
    const target = pending.length > 0 ? pending.slice(0, count) : tracks.slice(0, count);
    setSelectedTrackIds(target.map((t) => t.id));
  };
  const clearSelection = () => setSelectedTrackIds([]);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const estimatedSeconds = tracks
    .filter((t) => selectedTrackIds.includes(t.id))
    .reduce((acc, t) => acc + (t.durationSeconds || 1200), 0);
  const estimatedBytes = Math.round((estimatedSeconds / 60) * 0.75 * 1024 * 1024);

  const handleStartDownload = async () => {
    if (selectedTrackIds.length === 0 || isBulkDownloading) return;
    setIsBulkDownloading(true);
    try {
      const toDownload = tracks.filter((t) => selectedTrackIds.includes(t.id));
      for (const track of toDownload) {
        const state = chapterStates[track.id];
        if (state?.status === 'completed') continue;
        if (state?.status === 'paused' && state.remoteUrl) {
          await audioDownloadService.resumeDownload(book.id, track.id);
          continue;
        }
        if (!track.audioUrl) continue;
        await audioDownloadService.downloadChapter({
          bookId: book.id,
          chapterId: track.id,
          remoteUrl: track.audioUrl,
          bookTitle: book.title,
          chapterTitle: track.title,
        });
      }
      await refreshChapterStates();
      onDownloadComplete?.();
    } catch (e) {
      console.warn('Download error:', e);
    } finally {
      setIsBulkDownloading(false);
    }
  };

  const handlePauseTrack = async (trackId: string) => {
    await audioDownloadService.pauseDownload(book.id, trackId);
    await refreshChapterStates();
  };

  const handleResumeTrack = async (trackId: string) => {
    await audioDownloadService.resumeDownload(book.id, trackId);
    await refreshChapterStates();
  };

  const handleDeleteTrack = async (trackId: string) => {
    await audioDownloadService.deleteDownloadedChapter(book.id, trackId);
    await refreshChapterStates();
    onDownloadComplete?.();
  };

  const downloadedCount = tracks.filter((t) => chapterStates[t.id]?.status === 'completed').length;
  const activeCount = tracks.filter((t) => {
    const s = chapterStates[t.id]?.status;
    return s === 'downloading' || s === 'paused' || s === 'queued';
  }).length;

  return (
    <div
      id="chapter-download-modal-overlay"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="chapter-download-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[var(--surface)] rounded-t-3xl sm:rounded-3xl border border-[var(--border-subtle)] shadow-2xl overflow-hidden flex flex-col my-auto max-h-[85vh]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] shrink-0">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="text-sm font-semibold text-[var(--text-main)]">Download for Offline Listening</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin scrollbar-thumb-white/10">
          <div className="flex items-center gap-3 bg-[var(--surface-raised)] p-3 rounded-2xl border border-[var(--border-subtle)]">
            <img
              src={book.coverImageUrl}
              alt={book.title}
              className="w-12 h-16 object-cover rounded-lg shrink-0 border border-[var(--border-subtle)]"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-serif-display italic font-semibold text-[var(--text-main)] truncate">
                {book.title}
              </h4>
              <p className="text-[11px] text-[var(--accent)] font-serif-display italic truncate mt-0.5">
                {book.author}
              </p>
              <div className="flex items-center gap-2 text-[10px] text-[var(--text-dim)] mt-1 font-mono">
                <span>{tracks.length} Chapters</span>
                <span>•</span>
                <span className="text-emerald-400">{downloadedCount} Downloaded</span>
                {activeCount > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-[var(--accent)]">{activeCount} Active</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {isResolvingTracks ? (
            <div className="py-8 text-center text-[var(--text-dim)] text-xs">
              <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2" />
              Loading chapter list...
            </div>
          ) : resolveError ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs text-center">
              {resolveError}
            </div>
          ) : (
            <>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-dim)] block mb-2">
                  Quick Selection
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={selectAll}
                    className="p-2.5 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--accent-dim)] border border-[var(--border-subtle)] text-[11px] font-medium"
                  >
                    All ({tracks.length})
                  </button>
                  <button
                    onClick={() => selectNextN(3)}
                    className="p-2.5 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--accent-dim)] border border-[var(--border-subtle)] text-[11px] font-medium"
                  >
                    Next 3
                  </button>
                  <button
                    onClick={() => selectNextN(5)}
                    className="p-2.5 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--accent-dim)] border border-[var(--border-subtle)] text-[11px] font-medium"
                  >
                    Next 5
                  </button>
                  <button
                    onClick={clearSelection}
                    className="p-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-dim)]"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)] uppercase font-semibold px-1">
                  <span>Chapters ({selectedTrackIds.length} selected)</span>
                  <span>Est: ~{formatBytes(estimatedBytes)}</span>
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                  {tracks.map((track, idx) => {
                    const state = chapterStates[track.id];
                    const isDownloaded = state?.status === 'completed';
                    const isDownloading = state?.status === 'downloading';
                    const isPaused = state?.status === 'paused';
                    const isSelected = selectedTrackIds.includes(track.id);

                    return (
                      <div
                        key={track.id || idx}
                        onClick={() => toggleSelectTrack(track.id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--accent-dim)] border-[var(--accent)]'
                            : isDownloaded
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : 'bg-[var(--surface-raised)] border-[var(--border-subtle)]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border ${
                              isSelected
                                ? 'bg-[var(--accent)] border-[var(--accent)] text-black'
                                : 'border-[var(--border-subtle)]'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">
                              <span className="text-[var(--text-dim)] font-mono mr-1.5">{idx + 1}.</span>
                              {track.title}
                            </p>
                            <p className="text-[10px] text-[var(--text-dim)] font-mono">
                              {formatDuration(track.durationSeconds || 1200)}
                              {isDownloading && ` · ${state.percent}%`}
                              {isPaused && ' · Paused'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {isDownloading && (
                            <button
                              onClick={() => handlePauseTrack(track.id)}
                              className="p-1 rounded-lg text-amber-400 hover:bg-amber-500/10"
                              title="Pause"
                            >
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isPaused && (
                            <button
                              onClick={() => handleResumeTrack(track.id)}
                              className="p-1 rounded-lg text-[var(--accent)] hover:bg-[var(--accent-dim)]"
                              title="Resume"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                          )}
                          {isDownloaded && (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              <button
                                onClick={() => handleDeleteTrack(track.id)}
                                className="p-1 rounded-lg text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--surface-raised)] shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-[var(--surface-raised)] text-[var(--text-main)] text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-chapter-download"
              onClick={handleStartDownload}
              disabled={selectedTrackIds.length === 0 || isBulkDownloading || isResolvingTracks}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-[var(--on-accent)] text-xs font-bold flex items-center justify-center gap-2"
            >
              {isBulkDownloading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    Download {selectedTrackIds.length} Chapter{selectedTrackIds.length !== 1 ? 's' : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
