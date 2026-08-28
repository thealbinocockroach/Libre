import React from 'react';
import { PlayerState, Audiobook } from '../types';
import { Play, Pause, RotateCcw, RotateCw, SkipBack, SkipForward, Bookmark, X, Car, Volume2, Moon } from 'lucide-react';

interface CarModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerState: PlayerState;
  onTogglePlayPause: () => void;
  onRewind15: () => void;
  onForward30: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onAddBookmark: () => void;
  onOpenSleepTimer: () => void;
}

export const CarModeModal: React.FC<CarModeModalProps> = ({
  isOpen,
  onClose,
  playerState,
  onTogglePlayPause,
  onRewind15,
  onForward30,
  onNextTrack,
  onPrevTrack,
  onAddBookmark,
  onOpenSleepTimer,
}) => {
  if (!isOpen || !playerState.currentBook) return null;

  const { currentBook, currentTrack, isPlaying, isBuffering, currentTime, duration, sleepTimer } = playerState;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      id="car-mode-modal"
      className="fixed inset-0 z-50 bg-black text-[var(--text-main)] flex flex-col justify-between p-6 select-none animate-fade-in"
    >
      {/* Top Status Bar */}
      <header className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-[var(--accent)] text-[var(--on-accent)]">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] uppercase font-bold tracking-[0.25em] text-[var(--accent)]">
              Car Driving Mode
            </span>
            <h2 className="text-sm font-medium text-[var(--text-main)]">Simplified High-Contrast Controls</h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sleepTimer.isActive && (
            <div className="px-3 py-1.5 rounded-full bg-[var(--accent-dim)] border border-[var(--accent)] text-[var(--accent)] text-xs font-mono font-bold flex items-center gap-1.5">
              <Moon className="w-3.5 h-3.5 fill-current" />
              <span>{Math.ceil(sleepTimer.remainingSeconds / 60)}m</span>
            </div>
          )}
          <button
            id="btn-exit-car-mode"
            onClick={onClose}
            className="px-4 py-2 rounded-2xl border border-[var(--border-subtle)] hover:bg-[var(--surface-raised)] text-xs font-bold uppercase tracking-wider transition-colors"
          >
            Exit
          </button>
        </div>
      </header>

      {/* Large Book Metadata */}
      <div className="text-center py-6 space-y-3">
        <span className="text-sm font-semibold tracking-widest text-[var(--accent)] uppercase">
          {currentBook.author}
        </span>
        <h1 className="text-2xl sm:text-4xl font-serif-display italic font-bold text-[var(--text-main)] tracking-tight leading-snug line-clamp-2 px-2">
          {currentBook.title}
        </h1>
        <p className="text-sm sm:text-base text-[var(--text-dim)] font-medium">
          {currentTrack?.title || 'Chapter Audio Track'}
        </p>
        <div className="text-xs font-mono text-[var(--text-dim)] tracking-wider">
          {formatTime(currentTime)} / {formatTime(duration || currentTrack?.durationSeconds || 0)}
        </div>
      </div>

      {/* Giant Main Touch Controls */}
      <div className="space-y-6 max-w-lg mx-auto w-full">
        {/* Playback Row */}
        <div className="flex items-center justify-around gap-4">
          {/* Rewind 15s */}
          <button
            id="btn-car-rewind-15"
            onClick={onRewind15}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] border border-[var(--border-subtle)] active:scale-95 flex flex-col items-center justify-center gap-1 transition-all"
            title="Rewind 15s"
          >
            <RotateCcw className="w-7 h-7 sm:w-8 sm:h-8 text-[var(--accent)]" />
            <span className="text-[11px] font-bold font-mono">15s</span>
          </button>

          {/* Primary Giant Play / Pause Button */}
          <button
            id="btn-car-play-pause"
            onClick={onTogglePlayPause}
            className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] shadow-[0_0_40px_rgba(var(--accent-rgb),0.5)] active:scale-90 flex items-center justify-center transition-all"
          >
            {isPlaying ? (
              <Pause className="w-12 h-12 fill-current" />
            ) : (
              <Play className="w-12 h-12 fill-current ml-2" />
            )}
          </button>

          {/* Forward 30s */}
          <button
            id="btn-car-forward-30"
            onClick={onForward30}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] border border-[var(--border-subtle)] active:scale-95 flex flex-col items-center justify-center gap-1 transition-all"
            title="Forward 30s"
          >
            <RotateCw className="w-7 h-7 sm:w-8 sm:h-8 text-[var(--accent)]" />
            <span className="text-[11px] font-bold font-mono">30s</span>
          </button>
        </div>

        {/* Secondary Navigation Row: Prev / Bookmark / Sleep / Next */}
        <div className="grid grid-cols-4 gap-3">
          <button
            id="btn-car-prev-track"
            onClick={onPrevTrack}
            className="py-4 rounded-2xl bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] border border-[var(--border-subtle)] active:scale-95 flex flex-col items-center justify-center gap-1"
          >
            <SkipBack className="w-5 h-5 text-[var(--text-main)]" />
            <span className="text-[10px] font-bold text-[var(--text-dim)]">Prev</span>
          </button>

          <button
            id="btn-car-bookmark"
            onClick={onAddBookmark}
            className="py-4 rounded-2xl bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] border border-[var(--border-subtle)] active:scale-95 flex flex-col items-center justify-center gap-1"
          >
            <Bookmark className="w-5 h-5 text-[var(--accent)]" />
            <span className="text-[10px] font-bold text-[var(--text-dim)]">Bookmark</span>
          </button>

          <button
            id="btn-car-sleep-timer"
            onClick={onOpenSleepTimer}
            className="py-4 rounded-2xl bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] border border-[var(--border-subtle)] active:scale-95 flex flex-col items-center justify-center gap-1"
          >
            <Moon className="w-5 h-5 text-[var(--text-main)]" />
            <span className="text-[10px] font-bold text-[var(--text-dim)]">Sleep</span>
          </button>

          <button
            id="btn-car-next-track"
            onClick={onNextTrack}
            className="py-4 rounded-2xl bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] border border-[var(--border-subtle)] active:scale-95 flex flex-col items-center justify-center gap-1"
          >
            <SkipForward className="w-5 h-5 text-[var(--text-main)]" />
            <span className="text-[10px] font-bold text-[var(--text-dim)]">Next</span>
          </button>
        </div>
      </div>

      {/* Footer warning */}
      <footer className="text-center text-[11px] text-[var(--text-dim)] pt-4">
        Keep your eyes on the road. Controls optimized for safe single-tap touch.
      </footer>
    </div>
  );
};
