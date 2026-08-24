import React, { useState, useEffect } from 'react';
import { Audiobook, AudioTrack } from '../types';
import {
  X,
  Download,
  Check,
  HardDrive,
  Trash2,
  Clock,
  Layers,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import {
  downloadAudiobook,
  getDownloadedTrackIdsForBook,
  deleteDownloadedTrack,
  formatBytes,
} from '../utils/offlineStorage';

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
  const [downloadedTrackIds, setDownloadedTrackIds] = useState<string[]>([]);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  const tracks: AudioTrack[] =
    book.tracks && book.tracks.length > 0
      ? book.tracks
      : [
          {
            id: `${book.id}_tr_1`,
            title: book.title,
            audioUrl: 'https://archive.org/download/librivox_audio_collection/placeholder.mp3',
            durationSeconds: book.totalTimeSecs || 1800,
            trackNumber: 1,
          },
        ];

  const refreshStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const ids = await getDownloadedTrackIdsForBook(book.id);
      setDownloadedTrackIds(ids);
      // Pre-select tracks that aren't downloaded yet
      const notDownloaded = tracks.filter((t) => !ids.includes(t.id)).map((t) => t.id);
      setSelectedTrackIds(notDownloaded.length > 0 ? notDownloaded : tracks.map((t) => t.id));
    } catch {
      setDownloadedTrackIds([]);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshStatus();
      setProgress(0);
      setIsDownloading(false);
    }
  }, [isOpen, book.id]);

  if (!isOpen) return null;

  const toggleSelectTrack = (trackId: string) => {
    if (selectedTrackIds.includes(trackId)) {
      setSelectedTrackIds(selectedTrackIds.filter((id) => id !== trackId));
    } else {
      setSelectedTrackIds([...selectedTrackIds, trackId]);
    }
  };

  const selectAll = () => {
    setSelectedTrackIds(tracks.map((t) => t.id));
  };

  const selectNextN = (count: number) => {
    // Select first N un-downloaded tracks, or simply first N tracks
    const unDownloaded = tracks.filter((t) => !downloadedTrackIds.includes(t.id));
    const targetTracks = unDownloaded.length > 0 ? unDownloaded.slice(0, count) : tracks.slice(0, count);
    setSelectedTrackIds(targetTracks.map((t) => t.id));
  };

  const clearSelection = () => {
    setSelectedTrackIds([]);
  };

  // Approximate size: ~1MB per 1 minute of audio, or ~3.5MB per chapter
  const estimatedSeconds = tracks
    .filter((t) => selectedTrackIds.includes(t.id))
    .reduce((acc, t) => acc + (t.durationSeconds || 1200), 0);
  const estimatedBytes = Math.round((estimatedSeconds / 60) * 0.75 * 1024 * 1024);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const handleStartDownload = async () => {
    if (selectedTrackIds.length === 0 || isDownloading) return;
    setIsDownloading(true);
    setProgress(5);

    try {
      await downloadAudiobook(book, {
        trackIds: selectedTrackIds,
        onProgress: (p) => setProgress(p),
      });

      await refreshStatus();
      if (onDownloadComplete) {
        onDownloadComplete();
      }
    } catch (e) {
      console.warn('Download error:', e);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeleteSingleTrack = async (trackId: string) => {
    await deleteDownloadedTrack(book.id, trackId);
    await refreshStatus();
    if (onDownloadComplete) onDownloadComplete();
  };

  return (
    <div
      id="chapter-download-modal-overlay"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="chapter-download-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#0E0E0E] rounded-t-3xl sm:rounded-3xl border border-white/[0.12] shadow-2xl overflow-hidden flex flex-col my-auto max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] bg-[#141414]/90 shrink-0">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-[#C5A059]" />
            <h3 className="text-sm font-semibold text-white">Download for Offline Listening</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin scrollbar-thumb-white/10">
          {/* Book Info Snippet */}
          <div className="flex items-center gap-3 bg-white/[0.03] p-3 rounded-2xl border border-white/5">
            <img
              src={book.coverImageUrl}
              alt={book.title}
              className="w-12 h-16 object-cover rounded-lg shrink-0 border border-white/10"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-serif-display italic font-semibold text-white truncate">
                {book.title}
              </h4>
              <p className="text-[11px] text-[#C5A059] font-serif-display italic truncate mt-0.5">
                {book.author}
              </p>
              <div className="flex items-center gap-2 text-[10px] text-white/50 mt-1 font-mono">
                <span>{tracks.length} Chapters Total</span>
                <span>•</span>
                <span className="text-emerald-400">
                  {downloadedTrackIds.length} Downloaded
                </span>
              </div>
            </div>
          </div>

          {/* Quick Choice Presets */}
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-white/40 block mb-2">
              Quick Selection Choices
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={selectAll}
                className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-[#C5A059]/20 hover:border-[#C5A059]/40 border border-white/5 text-[11px] font-medium text-white transition-all text-center"
              >
                All Chapters ({tracks.length})
              </button>
              <button
                onClick={() => selectNextN(3)}
                className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-[#C5A059]/20 hover:border-[#C5A059]/40 border border-white/5 text-[11px] font-medium text-white transition-all text-center"
              >
                Next 3 Chapters
              </button>
              <button
                onClick={() => selectNextN(5)}
                className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-[#C5A059]/20 hover:border-[#C5A059]/40 border border-white/5 text-[11px] font-medium text-white transition-all text-center"
              >
                Next 5 Chapters
              </button>
              <button
                onClick={clearSelection}
                className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-[11px] font-medium text-white/60 transition-all text-center"
              >
                Clear Selection
              </button>
            </div>
          </div>

          {/* Chapters List with check toggles */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[10px] text-white/40 uppercase font-semibold px-1">
              <span>Select Specific Chapters ({selectedTrackIds.length} Selected)</span>
              <span>Est: ~{formatBytes(estimatedBytes)}</span>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
              {tracks.map((track, idx) => {
                const isDownloaded = downloadedTrackIds.includes(track.id);
                const isSelected = selectedTrackIds.includes(track.id);

                return (
                  <div
                    key={track.id || idx}
                    onClick={() => toggleSelectTrack(track.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#C5A059]/10 border-[#C5A059]/40 text-white'
                        : isDownloaded
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-white/80'
                        : 'bg-white/[0.02] border-white/5 hover:border-white/15 text-white/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                          isSelected
                            ? 'bg-[#C5A059] border-[#C5A059] text-black'
                            : 'border-white/30 bg-transparent'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">
                          <span className="text-white/40 font-mono mr-1.5">
                            {idx + 1}.
                          </span>
                          {track.title}
                        </p>
                        <p className="text-[10px] text-white/40 font-mono">
                          {formatDuration(track.durationSeconds || 1200)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isDownloaded && (
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/20">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Ready
                        </span>
                      )}

                      {isDownloaded && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSingleTrack(track.id);
                          }}
                          className="p-1 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete downloaded file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-white/[0.08] bg-[#141414] shrink-0 space-y-3">
          {isDownloading && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-white/70">
                <span className="flex items-center gap-1.5">
                  <div className="w-3 h-3 border-2 border-[#C5A059] border-t-transparent rounded-full animate-spin" />
                  Downloading selected chapters...
                </span>
                <span className="font-mono text-[#C5A059] font-bold">{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#C5A059] transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/70 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>

            <button
              id="btn-confirm-chapter-download"
              onClick={handleStartDownload}
              disabled={selectedTrackIds.length === 0 || isDownloading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#C5A059] hover:bg-[#d4af65] disabled:opacity-50 text-black text-xs font-bold transition-all shadow-[0_0_20px_rgba(197,160,89,0.3)] flex items-center justify-center gap-2"
            >
              {isDownloading ? (
                <span>Downloading {selectedTrackIds.length} Chapters...</span>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    Download {selectedTrackIds.length} Chapter{selectedTrackIds.length > 1 ? 's' : ''} (~{formatBytes(estimatedBytes)})
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
