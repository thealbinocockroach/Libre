import React, { useState, useEffect } from 'react';
import { PlayerState } from '../types';
import { User, Settings, BarChart3, X, Headphones, BookOpen, Flame } from 'lucide-react';
import { getTodayGoalProgress } from '../utils/goalTracker';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  playerState: PlayerState;
  onOpenStats: () => void;
  onOpenSettings: () => void;
}

export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({
  isOpen,
  onClose,
  playerState,
  onOpenStats,
  onOpenSettings,
}) => {
  const [displayName, setDisplayName] = useState('');
  const todayStats = getTodayGoalProgress();

  useEffect(() => {
    const saved = localStorage.getItem('libriaudio_profile_name');
    if (saved) setDisplayName(saved);
  }, [isOpen]);

  const totalListened = playerState.history.reduce((sum, b) => sum + (b.totalTimeSecs || 0), 0);
  const totalHours = Math.round(totalListened / 3600);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[95] bg-black/50 backdrop-blur-sm transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-72 sm:w-80 z-[100] bg-[var(--surface)] border-r border-[var(--border-subtle)] shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)]">
          <h2 className="text-lg font-serif-display italic font-bold text-[var(--text-main)] tracking-wide">
            Profile
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--bg)] hover:bg-[var(--surface-raised)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Card */}
        <div className="p-5 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] flex items-center justify-center text-[var(--on-accent)] shadow-lg shadow-[rgba(var(--accent-rgb),0.3)]">
              <User className="w-7 h-7" />
            </div>
            <div>
              <p className="text-base font-semibold text-[var(--text-main)]">
                {displayName || 'Listener'}
              </p>
              <p className="text-[11px] text-[var(--text-dim)]">Free audiobooks & ebooks</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-[var(--bg)] text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Headphones className="w-3 h-3 text-[var(--accent)]" />
              </div>
              <p className="text-sm font-bold text-[var(--text-main)]">{totalHours}h</p>
              <p className="text-[9px] text-[var(--text-dim)] uppercase tracking-wider">Listened</p>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--bg)] text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <BookOpen className="w-3 h-3 text-[var(--accent)]" />
              </div>
              <p className="text-sm font-bold text-[var(--text-main)]">{playerState.history.length}</p>
              <p className="text-[9px] text-[var(--text-dim)] uppercase tracking-wider">Books</p>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--bg)] text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Flame className="w-3 h-3 text-amber-400" />
              </div>
              <p className="text-sm font-bold text-[var(--text-main)]">{todayStats.dailyStreak}d</p>
              <p className="text-[9px] text-[var(--text-dim)] uppercase tracking-wider">Streak</p>
            </div>
          </div>
        </div>

        {/* Menu Tiles */}
        <div className="p-3 space-y-1.5">
          <button
            onClick={onOpenStats}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-[var(--bg)] transition-colors group text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)] shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">
                Listening Stats
              </p>
              <p className="text-[11px] text-[var(--text-dim)]">
                Hours, books, milestones & analytics
              </p>
            </div>
          </button>

          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-[var(--bg)] transition-colors group text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)] shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">
                Settings
              </p>
              <p className="text-[11px] text-[var(--text-dim)]">
                Theme, audio, data & profile
              </p>
            </div>
          </button>
        </div>
      </div>
    </>
  );
};
