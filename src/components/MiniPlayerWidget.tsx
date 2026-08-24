import React from 'react';
import { PlayerState } from '../types';
import { Play, Pause, RotateCcw, BookOpen, Moon, Sliders } from 'lucide-react';

interface MiniPlayerWidgetProps {
  playerState: PlayerState;
  onOpenFullPlayer: () => void;
  onTogglePlayPause: (e: React.MouseEvent) => void;
  onRewind15: (e: React.MouseEvent) => void;
  onOpenEbookReader?: (e: React.MouseEvent) => void;
  onOpenSleepTimer?: (e: React.MouseEvent) => void;
}

export const MiniPlayerWidget: React.FC<MiniPlayerWidgetProps> = ({
  playerState,
  onOpenFullPlayer,
  onTogglePlayPause,
  onRewind15,
  onOpenEbookReader,
  onOpenSleepTimer,
}) => {
  const { currentBook, currentTrack, isPlaying, isBuffering, currentTime, duration, sleepTimer, voiceEnhancer } = playerState;

  if (!currentBook) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      id="mini-player-container"
      onClick={onOpenFullPlayer}
      className="relative w-full bg-[#1A1A1A] rounded-xl overflow-hidden cursor-pointer hover:bg-[#222] transition-all duration-300 group flex flex-col"
    >
      <div className="flex items-center gap-4 p-2 sm:p-3">
        {/* Cover thumbnail */}
        <div className={`relative w-10 h-10 rounded-md overflow-hidden shrink-0 bg-[#0a0a0a] ${isBuffering ? 'animate-pulse' : ''}`}>
          <img
            src={currentBook.coverImageUrl}
            alt={currentBook.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Title and Author */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-sans font-medium text-white truncate group-hover:text-[#C5A059] transition-colors">
              {currentTrack?.title || currentBook.title}
            </h4>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-white/50 truncate font-sans">{currentBook.author}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center pr-2">
          {/* Play/Pause Button */}
          <button
            id="btn-mini-toggle-play"
            onClick={onTogglePlayPause}
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

      {/* Thin Bottom Progress Line */}
      <div className="w-full bg-white/5 h-[2px]">
        <div
          className="bg-[#C5A059] h-full transition-all duration-300 ease-linear"
          style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
        />
      </div>
    </div>
  );
};


