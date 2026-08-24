import React, { useState, useEffect } from 'react';
import {
  Target,
  Flame,
  Trophy,
  Sparkles,
  Edit3,
  Check,
  ChevronRight,
  Headphones,
  BookOpen,
  Plus,
  Minus,
} from 'lucide-react';
import {
  getTodayGoalProgress,
  setDailyGoalMinutes,
  GOAL_PRESETS,
  DailyGoalProgress,
} from '../utils/goalTracker';

export const DailyGoalRing: React.FC = () => {
  const [progress, setProgress] = useState<DailyGoalProgress>(getTodayGoalProgress());
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [customGoal, setCustomGoal] = useState(progress.goalMinutes);

  const refreshProgress = () => {
    setProgress(getTodayGoalProgress());
  };

  useEffect(() => {
    refreshProgress();
    const interval = setInterval(refreshProgress, 2000);

    const handleGoalChanged = () => refreshProgress();
    window.addEventListener('libriaudio-goal-changed', handleGoalChanged);

    return () => {
      clearInterval(interval);
      window.removeEventListener('libriaudio-goal-changed', handleGoalChanged);
    };
  }, []);

  const handleSelectPreset = (mins: number) => {
    setDailyGoalMinutes(mins);
    setCustomGoal(mins);
    setIsEditingGoal(false);
    refreshProgress();
  };

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    setDailyGoalMinutes(customGoal);
    setIsEditingGoal(false);
    refreshProgress();
  };

  // SVG Circular Math
  const radius = 54;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const normalizedProgress = Math.min(100, Math.max(0, progress.percentage));
  const strokeDashoffset = circumference - (normalizedProgress / 100) * circumference;

  return (
    <div
      id="daily-goal-widget"
      className="p-5 rounded-2xl bg-[#111111] border border-white/[0.08] shadow-xl relative overflow-hidden transition-all duration-300"
    >
      {/* Background Subtle Accent Aura */}
      <div
        className="absolute -top-12 -right-12 w-44 h-44 rounded-full blur-3xl opacity-20 pointer-events-none transition-all duration-700"
        style={{
          backgroundColor: progress.isGoalAchieved ? '#10b981' : '#C5A059',
        }}
      />

      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-[#C5A059]/15 border border-[#C5A059]/30 flex items-center justify-center text-[#C5A059]">
            {progress.isGoalAchieved ? (
              <Trophy className="w-4 h-4 text-amber-400" />
            ) : (
              <Target className="w-4 h-4" />
            )}
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              Daily Listening Goal
              {progress.isGoalAchieved && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Met Today
                </span>
              )}
            </h3>
            <p className="text-[11px] text-white/50 mt-0.5">
              {progress.isGoalAchieved
                ? `You reached your ${progress.goalMinutes}m target today!`
                : `${progress.remainingMinutes} mins left to complete today's goal`}
            </p>
          </div>
        </div>

        {/* Action button to adjust goal */}
        <button
          id="btn-edit-daily-goal"
          onClick={() => setIsEditingGoal(!isEditingGoal)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-[#C5A059]/20 text-white/70 hover:text-[#C5A059] border border-white/10 text-xs font-medium transition-all"
          title="Adjust Daily Goal"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline font-mono">{progress.goalMinutes}m Goal</span>
        </button>
      </div>

      {/* Goal Edit Drawer / Preset Bar */}
      {isEditingGoal && (
        <div className="mb-5 p-3.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between text-xs text-white/80">
            <span className="font-semibold text-white">Select Daily Goal Target:</span>
            <button
              onClick={() => setIsEditingGoal(false)}
              className="text-[11px] text-white/40 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {GOAL_PRESETS.map((preset) => (
              <button
                key={preset}
                id={`btn-goal-preset-${preset}`}
                onClick={() => handleSelectPreset(preset)}
                className={`py-2 px-1 rounded-xl text-xs font-mono font-bold transition-all border ${
                  progress.goalMinutes === preset
                    ? 'bg-[#C5A059] text-black border-[#C5A059] shadow-md shadow-[#C5A059]/20'
                    : 'bg-white/[0.04] text-white/70 hover:text-white border-white/10 hover:border-white/20'
                }`}
              >
                {preset} min
              </button>
            ))}
          </div>

          <form onSubmit={handleSaveCustom} className="flex items-center gap-2 pt-1">
            <div className="flex-1 flex items-center bg-white/[0.03] border border-white/10 rounded-xl px-3 py-1.5">
              <span className="text-xs text-white/40 mr-2">Custom:</span>
              <input
                type="number"
                min="5"
                max="720"
                value={customGoal}
                onChange={(e) => setCustomGoal(parseInt(e.target.value, 10) || 5)}
                className="w-16 bg-transparent text-xs font-mono text-white focus:outline-none"
              />
              <span className="text-xs text-white/40">minutes / day</span>
            </div>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-[#C5A059] text-black font-semibold text-xs hover:bg-[#d4af65] transition-colors"
            >
              Apply
            </button>
          </form>
        </div>
      )}

      {/* Main Goal Content with Progress Ring and Stats */}
      <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
        {/* SVG Progress Ring */}
        <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 130 130">
            {/* Background Track */}
            <circle
              cx="65"
              cy="65"
              r={radius}
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Progress Stroke */}
            <circle
              cx="65"
              cy="65"
              r={radius}
              stroke={progress.isGoalAchieved ? '#10b981' : 'url(#goldGradient)'}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-out"
            />
            {/* Gradient definition */}
            <defs>
              <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d4af65" />
                <stop offset="100%" stopColor="#C5A059" />
              </linearGradient>
            </defs>
          </svg>

          {/* Center Info inside Ring */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold font-mono tracking-tight text-white">
              {progress.percentage}%
            </span>
            <span className="text-[10px] uppercase tracking-wider text-white/50 font-semibold mt-0.5">
              {progress.listenedMinutes} / {progress.goalMinutes}m
            </span>
          </div>
        </div>

        {/* Goal Highlights & Streak Column */}
        <div className="flex-1 w-full space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-white/40 text-[10px] uppercase font-semibold">
                <span>Today's Audio</span>
                <Headphones className="w-3.5 h-3.5 text-[#C5A059]" />
              </div>
              <div className="mt-1">
                <span className="text-base font-bold font-mono text-white">
                  {progress.listenedMinutes}m
                </span>
                <span className="text-[11px] text-white/40 ml-1">logged</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-white/40 text-[10px] uppercase font-semibold">
                <span>Daily Streak</span>
                <Flame className="w-3.5 h-3.5 text-amber-400 fill-current" />
              </div>
              <div className="mt-1">
                <span className="text-base font-bold font-mono text-amber-400">
                  {progress.dailyStreak} Day{progress.dailyStreak !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Progress Bar & Dynamic Motivational Message */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-white/70 font-medium">
                {progress.isGoalAchieved ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Target Complete!
                  </span>
                ) : (
                  <span>
                    {progress.remainingMinutes} min{progress.remainingMinutes !== 1 ? 's' : ''} remaining
                  </span>
                )}
              </span>
              <span className="text-white/40 font-mono text-[10px]">
                Target: {progress.goalMinutes} mins
              </span>
            </div>

            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  progress.isGoalAchieved
                    ? 'bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                    : 'bg-[#C5A059] shadow-[0_0_12px_rgba(197,160,89,0.4)]'
                }`}
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
