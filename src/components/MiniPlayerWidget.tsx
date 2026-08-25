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
      className="relative w-full bg-[#1A1A1A] rounded-xl overflow-hidden cursor-pointer hover:bg-[#222] transition-all duration-300 group"
    >
      <div className="flex items-center gap-3 p-2.5 sm:p-3">
        {/* Cover thumbnail */}
        <div className={`relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-[#0a0a0a] ${isBuffering ? 'animate-pulse' : ''}`}>
          <img
            src={currentBook.coverImageUrl}
            alt={currentBook.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Title and Author */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-sans font-medium text-white truncate group-hover:text-[#C5A059] transition-colors leading-tight">
            {currentBook.title}
          </h4>
          <p className="text-xs text-white/50 truncate font-sans mt-0.5">{currentBook.author}</p>
        </div>

        {/* Play/Pause Button */}
        <button
          id="btn-mini-toggle-play"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePlayPause(e);
          }}
          className="w-10 h-10 flex items-center justify-center text-white hover:text-[#C5A059] transition-colors active:scale-95 shrink-0"
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
