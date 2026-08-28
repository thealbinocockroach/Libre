import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PlayerState, Audiobook, AudioTrack } from '../types';
import {
  ChevronDown,
  ListMusic,
  Bookmark,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  X,
  Radio,
  Check,
  BookOpen,
  Moon,
  Sliders,
  Car,
  Download,
  CheckCircle2,
  FileText,
  Trash2,
  HardDrive,
  Layers,
  Sparkles,
  ArrowDownCircle,
} from 'lucide-react';
import {
  getBookDownloadSummary,
  downloadAudiobook,
  deleteDownloadedTrack,
  formatBytes,
} from '../utils/offlineStorage';
import { getNotesForBook } from '../utils/notesStorage';
import { BookNotesModal } from './BookNotesModal';
import {
  getSavedQualityPreference,
  saveQualityPreference,
} from '../utils/audioQualityManager';
import { AudioQualityPreference } from '../types';

interface FullPlayerModalProps {
  playerState: PlayerState;
  onClose: () => void;
  onTogglePlayPause: () => void;
  onSeek: (seconds: number) => void;
  onRewind15: () => void;
  onForward30: () => void;
  onSkipNext: () => void;
  onSkipPrevious: () => void;
  onSelectTrack: (trackIndex: number) => void;
  onToggleSaveBook: (book: Audiobook) => void;
  isSaved: boolean;
  onOpenEbookReader?: () => void;
  onOpenSleepTimer?: () => void;
  onOpenVoiceEnhancer?: () => void;
  onOpenBookmarks?: () => void;
  onOpenCarMode?: () => void;
  onOpenOfflineManager?: () => void;
  isDownloaded?: boolean;
}

export const FullPlayerModal: React.FC<FullPlayerModalProps> = ({
  playerState,
  onClose,
  onTogglePlayPause,
  onSeek,
  onRewind15,
  onForward30,
  onSkipNext,
  onSkipPrevious,
  onSelectTrack,
  onToggleSaveBook,
  isSaved,
  onOpenEbookReader,
  onOpenSleepTimer,
  onOpenVoiceEnhancer,
  onOpenBookmarks,
  onOpenCarMode,
  onOpenOfflineManager,
}) => {
  const [showChapters, setShowChapters] = useState(false);
  const [showOfflineDrawer, setShowOfflineDrawer] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);

  // Offline State
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

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [notesCount, setNotesCount] = useState(0);

  const {
    currentBook,
    currentTrack,
    currentTrackIndex,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    playbackSpeed,
    sleepTimer,
    voiceEnhancer,
  } = playerState;

  const refreshOfflineState = async () => {
    if (!currentBook) return;
    try {
      const summary = await getBookDownloadSummary(currentBook);
      setDownloadSummary(summary);
    } catch {
      // fallback
    }
  };

  const refreshNotesCount = () => {
    if (!currentBook) return;
    const notes = getNotesForBook(currentBook.id);
    setNotesCount(notes.length);
  };

  useEffect(() => {
    if (currentBook) {
      refreshOfflineState();
      refreshNotesCount();
    }
  }, [currentBook?.id]);

  useEffect(() => {
    if (!currentBook) return;
    const handleNotesChange = () => refreshNotesCount();
    window.addEventListener('libriaudio_notes_updated', handleNotesChange);
    return () => window.removeEventListener('libriaudio_notes_updated', handleNotesChange);
  }, [currentBook?.id]);

  if (!currentBook) return null;

  const tracks: AudioTrack[] =
    currentBook.tracks && currentBook.tracks.length > 0
      ? currentBook.tracks
      : [
          {
            id: `${currentBook.id}_tr_1`,
            title: currentBook.title,
            audioUrl: 'https://archive.org/download/librivox_audio_collection/placeholder.mp3',
            durationSeconds: currentBook.totalTimeSecs || 1800,
            trackNumber: 1,
          },
        ];

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00:00';
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = Math.floor(secs % 60);
    return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const currentDuration = duration > 0 ? duration : currentTrack?.durationSeconds || currentBook.totalTimeSecs;

  // --- Drag-scrub state for smooth progress bar interaction ---
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPercent, setDragPercent] = useState<number | null>(null);
  const dragPercentRef = useRef<number>(0);

  const getTimeFromPosition = useCallback((clientX: number): number => {
    const bar = progressBarRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    return percent * currentDuration;
  }, [currentDuration]);

  const getPercentFromPosition = useCallback((clientX: number): number => {
    const bar = progressBarRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(1, x / rect.width)) * 100;
  }, []);

  const handleDragStart = useCallback((clientX: number) => {
    setIsDragging(true);
    const pct = getPercentFromPosition(clientX);
    dragPercentRef.current = pct;
    setDragPercent(pct);
  }, [getPercentFromPosition]);

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging) return;
    const pct = getPercentFromPosition(clientX);
    dragPercentRef.current = pct;
    setDragPercent(pct);
  }, [isDragging, getPercentFromPosition]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    const seekTime = (dragPercentRef.current / 100) * currentDuration;
    setDragPercent(null);
    onSeek(seekTime);
  }, [isDragging, currentDuration, onSeek]);

  // Mouse event handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX);
  }, [handleDragStart]);

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX);
    const onMouseUp = () => handleDragEnd();

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Touch event handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientX);
  }, [handleDragStart]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientX);
  }, [handleDragMove]);

  const onTouchEnd = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  // The displayed percent — live drag position or actual playback position
  const displayPercent = isDragging && dragPercent !== null
    ? dragPercent
    : (currentTime / currentDuration) * 100;

  // Download all or remaining chapters
  const handleDownloadRemaining = async () => {
    if (isDownloading) return;
    const remainingTrackIds = tracks
      .filter((t) => !downloadSummary.downloadedTrackIds.includes(t.id))
      .map((t) => t.id);

    const targetIds = remainingTrackIds.length > 0 ? remainingTrackIds : tracks.map((t) => t.id);
    if (targetIds.length === 0) return;

    setIsDownloading(true);
    setDownloadProgress(5);

    try {
      await downloadAudiobook(currentBook, {
        trackIds: targetIds,
        onProgress: (p) => setDownloadProgress(p),
      });
      await refreshOfflineState();
    } catch (e) {
      console.warn('Download error:', e);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  // Toggle single track download/delete
  const handleToggleTrackOffline = async (track: AudioTrack) => {
    const isDownloaded = downloadSummary.downloadedTrackIds.includes(track.id);
    if (isDownloaded) {
      await deleteDownloadedTrack(currentBook.id, track.id);
      await refreshOfflineState();
    } else {
      setIsDownloading(true);
      setDownloadProgress(10);
      try {
        await downloadAudiobook(currentBook, {
          trackIds: [track.id],
          onProgress: (p) => setDownloadProgress(p),
        });
        await refreshOfflineState();
      } catch (e) {
        console.warn('Track download error:', e);
      } finally {
        setIsDownloading(false);
        setDownloadProgress(0);
      }
    }
  };

  const remainingChaptersCount = Math.max(0, tracks.length - downloadSummary.downloadedCount);
  const estimatedRemainingBytes = remainingChaptersCount * 3.5 * 1024 * 1024;

  return (
    <>
      <div
        id="full-player-modal-backdrop"
        className="fixed inset-0 bg-[var(--overlay)] backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          id="full-player-modal"
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg bg-[var(--surface)] border border-[var(--border-subtle)] rounded-3xl p-5 sm:p-7 text-[var(--text-main)] shadow-2xl overflow-hidden flex flex-col justify-between max-h-[94vh]"
        >
          {/* Ambient background glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-[var(--accent-dim)] rounded-full blur-3xl pointer-events-none" />

          {/* Top Action Bar */}
          <div id="player-top-bar" className="relative flex items-center justify-between z-10">
            <button
              id="btn-dismiss-player"
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface-raised)] transition-colors cursor-pointer"
              title="Minimize player"
            >
              <ChevronDown className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center max-w-[220px] text-center">
              <span className="text-[9px] uppercase font-semibold tracking-[0.25em] text-[var(--accent)]">Now Playing</span>
              <span className="text-xs font-serif-display italic text-[var(--text-main)] truncate w-full mt-0.5">
                {currentBook.title}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                id="btn-save-audiobook"
                onClick={() => onToggleSaveBook(currentBook)}
                className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors cursor-pointer ${
                  isSaved
                    ? 'text-[var(--accent)] bg-[var(--accent-dim)] border border-[var(--accent)]'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface-raised)]'
                }`}
                title={isSaved ? 'Saved to Library' : 'Save to Library'}
              >
                <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
              </button>

              <button
                id="btn-toggle-chapters"
                onClick={() => setShowChapters(true)}
                className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface-raised)] transition-colors cursor-pointer"
                title="Chapter tracks"
              >
                <ListMusic className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Large Artwork Display */}
          <div id="player-cover-container" className="relative my-auto flex flex-col items-center z-10 py-2">
            <div className={`relative w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-[var(--border-subtle)] ring-1 ring-[var(--border-subtle)] bg-[var(--surface)] group ${isBuffering ? 'animate-pulse' : ''}`}>
              <img
                src={currentBook.coverImageUrl}
                alt={currentBook.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
              {isPlaying && (
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md border border-[var(--accent)] flex items-center gap-1.5 text-[9px] text-[var(--accent)] font-medium tracking-wider uppercase shadow-lg">
                  <Radio className="w-3 h-3 text-[var(--accent)] animate-pulse" /> Stream
                </div>
              )}
            </div>

            {/* Audiobook & Chapter Meta */}
            <div className="text-center mt-4 px-3 max-w-full">
              <h2 className="text-base sm:text-lg font-serif-display italic font-semibold text-[var(--text-main)] leading-tight truncate">
                {currentTrack?.title || currentBook.title}
              </h2>
              <p className="text-xs font-serif-display italic text-[var(--text-dim)] mt-1 truncate">{currentBook.author}</p>
              <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
                {currentBook.reader && (
                  <p className="text-[10px] uppercase tracking-wider text-[var(--accent)] truncate">
                    Narrated by {currentBook.reader}
                  </p>
                )}
                {currentBook.availableQualities && (
                  <span className="text-[9px] font-mono font-bold bg-[var(--surface-raised)] text-[var(--text-dim)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] uppercase">
                    {(currentBook.selectedQuality || getSavedQualityPreference()) === '128k' ? '128 kbps' : (currentBook.selectedQuality || getSavedQualityPreference()) === '64k' ? '64 kbps' : 'HQ Stream'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Playback Scrubbing & Controls */}
          <div id="player-controls-container" className="relative space-y-3.5 z-10">
            {/* Timeline Slider — smooth drag-scrub */}
            <div className="space-y-1.5">
              <div
                ref={progressBarRef}
                className="w-full h-2 bg-[var(--surface-raised)] rounded-full cursor-pointer relative transition-all group"
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onClick={(e) => {
                  if (isDragging) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const percent = Math.max(0, Math.min(1, x / rect.width));
                  onSeek(percent * currentDuration);
                }}
              >
                {/* Played portion */}
                <div
                  className="absolute top-0 left-0 h-full bg-[var(--accent)] rounded-full"
                  style={{ width: `${Math.max(0, Math.min(100, displayPercent))}%` }}
                />
                {/* Thumb indicator */}
                <div
                  className={`absolute top-1/2 rounded-full shadow-lg bg-[var(--text-main)] transition-transform ${isDragging ? 'w-4 h-4 scale-150' : 'w-3 h-3 group-hover:scale-125'}`}
                  style={{ left: `${Math.max(0, Math.min(100, displayPercent))}%`, transform: 'translate(-50%, -50%)' }}
                />
              </div>
              <div className="flex justify-between text-[10px] tracking-wider font-mono text-[var(--accent)] px-0.5">
                <span>{formatTime(isDragging && dragPercent !== null ? (dragPercent / 100) * currentDuration : currentTime)}</span>
                <span>{formatTime(currentDuration)}</span>
              </div>
            </div>

            {/* Control Buttons Row */}
            <div className="flex items-center justify-between px-2 sm:px-4">
              {/* Previous Track */}
              <button
                id="btn-player-skip-prev"
                onClick={onSkipPrevious}
                className="p-3 rounded-full bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] text-[var(--text-main)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] transition-all active:scale-95 cursor-pointer"
                title="Previous Track"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              {/* Rewind 15s */}
              <button
                id="btn-player-rewind-15"
                onClick={onRewind15}
                className="p-3 rounded-full bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] text-[var(--text-main)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] transition-all active:scale-95 cursor-pointer"
                title="Rewind 15 Seconds"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Big Play / Pause */}
              <button
                id="btn-player-main-play"
                onClick={onTogglePlayPause}
                className="w-15 h-15 sm:w-16 sm:h-16 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] flex items-center justify-center shadow-[0_0_30px_rgba(var(--accent-rgb),0.35)] transition-all transform active:scale-95 cursor-pointer"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-1" />
                )}
              </button>

              {/* Forward 30s */}
              <button
                id="btn-player-forward-30"
                onClick={onForward30}
                className="p-3 rounded-full bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] text-[var(--text-main)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] transition-all active:scale-95 cursor-pointer"
                title="Fast Forward 30 Seconds"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Next Chapter */}
              <button
                id="btn-player-skip-next"
                onClick={onSkipNext}
                className="p-3 rounded-full bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] text-[var(--text-main)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] transition-all active:scale-95 cursor-pointer"
                title="Next Track"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {/* Audio Enhancement & Convenience Toolbar */}
            <div className="pt-2.5 grid grid-cols-5 gap-1.5 border-t border-[var(--border-subtle)]">
              {/* Voice Enhancer / EQ Preset */}
              {onOpenVoiceEnhancer ? (
                <button
                  id="btn-player-voice-enhancer"
                  onClick={onOpenVoiceEnhancer}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl border text-[10px] font-semibold transition-all cursor-pointer ${
                    voiceEnhancer !== 'off'
                      ? 'bg-[var(--accent-dim)] border-[var(--accent)] text-[var(--accent)]'
                      : 'bg-[var(--surface-raised)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface-raised)]'
                  }`}
                  title="Voice Clarity & Equalizer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span className="truncate">{voiceEnhancer === 'voice_boost' ? 'Voice +' : voiceEnhancer === 'noise_reduce' ? 'De-Hiss' : 'EQ'}</span>
                </button>
              ) : <div />}

              {/* Notes & Reflections Trigger */}
              <button
                id="btn-player-notes-bottom"
                onClick={() => setShowNotesModal(true)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl border text-[10px] font-semibold transition-all cursor-pointer ${
                  notesCount > 0
                    ? 'bg-[var(--accent-dim)] border-[var(--accent)] text-[var(--accent)]'
                    : 'bg-[var(--surface-raised)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface-raised)]'
                }`}
                title="Book Notes & Reflections"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="truncate">{notesCount > 0 ? `${notesCount} Notes` : 'Notes'}</span>
              </button>

              {/* Sleep Timer Indicator / Trigger */}
              {onOpenSleepTimer ? (
                <button
                  id="btn-player-sleep-timer-bottom"
                  onClick={onOpenSleepTimer}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl border text-[10px] font-semibold transition-all cursor-pointer ${
                    sleepTimer.isActive
                      ? 'bg-[var(--accent-dim)] border-[var(--accent)] text-[var(--accent)]'
                      : 'bg-[var(--surface-raised)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface-raised)]'
                  }`}
                  title="Sleep Timer"
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span className="truncate">
                    {sleepTimer.isActive
                      ? sleepTimer.isEndOfChapter
                        ? 'Ch End'
                        : `${Math.ceil(sleepTimer.remainingSeconds / 60)}m`
                      : 'Sleep'}
                  </span>
                </button>
              ) : <div />}

              {/* Offline Download Toggle & Status Trigger */}
              <button
                id="btn-player-offline-download"
                onClick={() => setShowOfflineDrawer(true)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl border text-[10px] font-semibold transition-all cursor-pointer ${
                  isDownloading
                    ? 'bg-[var(--warning-dim)] border-[var(--warning)] text-[var(--warning)] animate-pulse'
                    : downloadSummary.isFullyDownloaded
                    ? 'bg-[var(--success-dim)] border-[var(--success)] text-[var(--success)]'
                    : downloadSummary.isPartiallyDownloaded
                    ? 'bg-[var(--accent-dim)] border-[var(--accent)] text-[var(--accent)]'
                    : 'bg-[var(--surface-raised)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface-raised)]'
                }`}
                title="Toggle Offline Chapters Download"
              >
                {isDownloading ? (
                  <>
                    <div className="w-3 h-3 border-2 border-[var(--warning)] border-t-transparent rounded-full animate-spin shrink-0" />
                    <span className="truncate">{downloadProgress}%</span>
                  </>
                ) : downloadSummary.isFullyDownloaded ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)] shrink-0" />
                    <span className="truncate">Saved</span>
                  </>
                ) : downloadSummary.isPartiallyDownloaded ? (
                  <>
                    <Download className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                    <span className="truncate">{downloadSummary.downloadedCount}/{downloadSummary.totalTracks}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Offline</span>
                  </>
                )}
              </button>

              {/* Car Mode */}
              {onOpenCarMode ? (
                <button
                  id="btn-player-car-mode"
                  onClick={onOpenCarMode}
                  className="flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-main)] text-[10px] font-semibold transition-all cursor-pointer"
                  title="Car Driving Mode"
                >
                  <Car className="w-3.5 h-3.5" />
                  <span className="truncate">Car</span>
                </button>
              ) : <div />}
            </div>

            {/* Read Book Ebook Button Banner */}
            {onOpenEbookReader && (
              <div className="pt-0.5 flex justify-center">
                <button
                  id="btn-read-ebook-banner"
                  onClick={onOpenEbookReader}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-[var(--surface-raised)] hover:bg-[var(--accent-dim)] text-[var(--text-main)] hover:text-[var(--accent)] border border-[var(--border-subtle)] hover:border-[var(--accent)] text-xs font-serif-display italic transition-all active:scale-98 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Read Gutenberg Ebook Text & Sync Audio</span>
                </button>
              </div>
            )}
          </div>

          {/* Chapters Modal Drawer */}
          {showChapters && (
            <div
              id="chapters-drawer"
              className="absolute inset-0 bg-[var(--bg)] backdrop-blur-2xl z-50 flex flex-col px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <ListMusic className="w-4 h-4 text-[var(--accent)] shrink-0" />
                  <div>
                    <h3 className="font-serif-display italic font-semibold text-sm text-[var(--text-main)] leading-tight">
                      Chapters ({currentBook.tracks.length})
                    </h3>
                    <p className="text-[10px] text-[var(--text-dim)] font-mono">
                      Continuous Unabridged Stream
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {currentBook.availableQualities && currentBook.availableQualities.length > 1 && (
                    <div className="flex items-center bg-[var(--surface-raised)] p-0.5 rounded-lg border border-[var(--border-subtle)]">
                      {currentBook.availableQualities.map((q) => {
                        const isQActive = (currentBook.selectedQuality || getSavedQualityPreference()) === q;
                        return (
                          <button
                            key={q}
                            onClick={() => {
                              saveQualityPreference(q as AudioQualityPreference);
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                              isQActive
                                ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-sm'
                                : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'
                            }`}
                          >
                            {q}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <button
                    id="btn-close-chapters"
                    onClick={() => setShowChapters(false)}
                    className="p-1.5 rounded-full text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface-raised)] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto py-2 space-y-1.5 scrollbar-thin scrollbar-thumb-[var(--scrollbar)]">
                {currentBook.tracks.map((track, idx) => {
                  const isCurrent = idx === currentTrackIndex;
                  const isTrackOffline = downloadSummary.downloadedTrackIds.includes(track.id);

                  return (
                    <div
                      key={track.id}
                      id={`chapter-item-${idx}`}
                      onClick={() => {
                        onSelectTrack(idx);
                        setShowChapters(false);
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                        isCurrent
                          ? 'bg-[var(--accent-dim)] border border-[var(--accent)] text-[var(--accent)]'
                          : 'hover:bg-[var(--surface-raised)] text-[var(--text-main)] border border-transparent hover:text-[var(--text-main)]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono opacity-50 w-5">{idx + 1}.</span>
                        <span className="text-xs font-serif-display italic truncate">{track.title}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs opacity-75 shrink-0">
                        {isTrackOffline && (
                          <span className="text-[10px] font-mono text-[var(--success)] bg-[var(--success-dim)] px-1.5 py-0.5 rounded border border-[var(--success)]">
                            Offline
                          </span>
                        )}
                        <span className="font-mono text-[10px]">{formatTime(track.durationSeconds)}</span>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-[var(--accent)]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Interactive Offline Download & Chapter Toggle Drawer */}
          {showOfflineDrawer && (
            <div
              id="player-offline-drawer"
              className="absolute inset-0 bg-[var(--bg)] backdrop-blur-2xl z-50 flex flex-col px-4 sm:px-5 pb-4 sm:pb-5 pt-[max(env(safe-area-inset-top),1rem)] animate-in fade-in zoom-in-95 duration-200"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif-display italic font-semibold text-sm text-[var(--text-main)] flex items-center gap-2">
                      Offline Audio Downloads
                    </h3>
                    <p className="text-[11px] text-[var(--text-dim)]">
                      {downloadSummary.downloadedCount} of {tracks.length} chapters downloaded
                    </p>
                  </div>
                </div>
                <button
                  id="btn-close-offline-drawer"
                  onClick={() => setShowOfflineDrawer(false)}
                  className="p-1.5 rounded-full text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface-raised)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Download Status & 1-Tap Toggle Banner */}
              <div className="my-3 p-3.5 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] space-y-3 shrink-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-main)]">
                    {downloadSummary.isFullyDownloaded ? (
                      <span className="text-[var(--success)] font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> All chapters ready offline ({formatBytes(downloadSummary.sizeBytes)})
                      </span>
                    ) : (
                      <span>
                        <strong className="text-[var(--warning)]">{remainingChaptersCount}</strong> chapters needed (~{formatBytes(estimatedRemainingBytes)})
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--accent)]">
                    {Math.round((downloadSummary.downloadedCount / tracks.length) * 100)}% Complete
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-[var(--surface-raised)] overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      downloadSummary.isFullyDownloaded ? 'bg-[var(--success)]' : 'bg-[var(--accent)]'
                    }`}
                    style={{
                      width: isDownloading
                        ? `${Math.max(10, downloadProgress)}%`
                        : `${(downloadSummary.downloadedCount / tracks.length) * 100}%`,
                    }}
                  />
                </div>

                {/* Primary Action Button */}
                {!downloadSummary.isFullyDownloaded ? (
                  <button
                    id="btn-download-remaining-chapters"
                    onClick={handleDownloadRemaining}
                    disabled={isDownloading}
                    className="w-full py-2.5 px-4 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-[var(--on-accent)] font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[rgba(var(--accent-rgb),0.3)] transition-all cursor-pointer active:scale-98"
                  >
                    {isDownloading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-[var(--on-accent)] border-t-transparent rounded-full animate-spin" />
                        <span>Downloading Remaining Chapters ({downloadProgress}%)...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>
                          Download {remainingChaptersCount === tracks.length ? 'All Chapters' : `${remainingChaptersCount} Remaining Chapters`}
                        </span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="flex items-center justify-between text-xs text-[var(--text-dim)] pt-1">
                    <span className="text-[11px] text-[var(--success)]">Available offline without internet</span>
                    {onOpenOfflineManager && (
                      <button
                        onClick={() => {
                          setShowOfflineDrawer(false);
                          onOpenOfflineManager();
                        }}
                        className="text-[11px] text-[var(--accent)] hover:underline"
                      >
                        Manage in Storage
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Granular Chapter Download / Delete Toggles */}
              <div className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider px-1 pb-1">
                Toggle Individual Chapters
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-[var(--scrollbar)]">
                {tracks.map((track, idx) => {
                  const isTrackOffline = downloadSummary.downloadedTrackIds.includes(track.id);

                  return (
                    <div
                      key={track.id}
                      className="p-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-mono text-[var(--text-dim)] w-5">{idx + 1}.</span>
                        <div className="min-w-0">
                          <p className="text-xs font-serif-display italic text-[var(--text-main)] truncate">
                            {track.title}
                          </p>
                          <p className="text-[10px] text-[var(--text-dim)] font-mono">
                            {formatTime(track.durationSeconds || 1200)} • ~{formatBytes((track.durationSeconds || 1200) * 58000)}
                          </p>
                        </div>
                      </div>

                      {/* Download / Delete Toggle Button */}
                      <button
                        onClick={() => handleToggleTrackOffline(track)}
                        disabled={isDownloading}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                          isTrackOffline
                            ? 'bg-[var(--success-dim)] border border-[var(--success)] text-[var(--success)] hover:bg-[var(--danger-dim)] hover:border-[var(--danger)] hover:text-[var(--danger)]'
                            : 'bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent-dim)]'
                        }`}
                        title={isTrackOffline ? 'Click to remove offline file' : 'Click to download chapter'}
                      >
                        {isTrackOffline ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Saved</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Book Notes & Reflections Modal */}
      <BookNotesModal
        isOpen={showNotesModal}
        book={currentBook}
        currentTrackTitle={currentTrack?.title}
        currentTrackIndex={currentTrackIndex}
        currentTime={currentTime}
        onClose={() => setShowNotesModal(false)}
        onSeekToTime={(trackIdx, secs) => {
          onSelectTrack(trackIdx);
          onSeek(secs);
          setShowNotesModal(false);
        }}
      />
    </>
  );
};
