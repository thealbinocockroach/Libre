import React from 'react';
import { PlayerState } from '../types';
import { Play, Pause } from 'lucide-react';

interface MiniPlayerWidgetProps {
  playerState: PlayerState;
  onOpenFullPlayer: () => void;
  onTogglePlayPause: (e: React.MouseEvent) => void;
}

export const MiniPlayerWidget: React.FC<MiniPlayerWidgetProps> = ({
  playerState,
  onOpenFullPlayer,
  onTogglePlayPause,
}) => {
  const { currentBook, isPlaying, isBuffering } = playerState;

  if (!currentBook) return null;

  return (
    <div
      id="mini-player-container"
      onClick={onOpenFullPlayer}
      className="relative w-full bg-[var(--surface)] rounded-2xl ring-1 ring-[var(--border-subtle)] shadow-[0_-4px_20px_rgba(0,0,0,0.25)] overflow-hidden cursor-pointer hover:bg-[var(--surface-raised)] transition-all duration-300 group"
    >
      <div className="flex items-center gap-3 p-2.5 sm:p-3">
        {/* Cover thumbnail */}
        <div className={`relative w-11 h-11 overflow-hidden shrink-0 bg-[var(--bg)] ${isBuffering ? 'animate-pulse' : ''}`}>
          <img
            src={currentBook.coverImageUrl}
            alt={currentBook.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Title and Author */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-sans font-medium text-[var(--text-main)] truncate group-hover:text-[var(--accent)] transition-colors leading-tight">
            {currentBook.title}
          </h4>
          <p className="text-xs text-[var(--text-dim)] truncate font-sans mt-0.5">{currentBook.author}</p>
        </div>

        {/* Play/Pause Button */}
        <button
          id="btn-mini-toggle-play"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePlayPause(e);
          }}
          className="w-10 h-10 flex items-center justify-center text-[var(--text-main)] hover:text-[var(--accent)] transition-colors active:scale-95 shrink-0"
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 fill-current" />
          ) : (
            <Play className="w-6 h-6 fill-current ml-0.5" />
          )}
        </button>
      </div>
    </div>
  );
};
