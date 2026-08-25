import React, { useState, useMemo, useEffect } from 'react';
import { Audiobook, ReadingSessionRecord } from '../types';
import { DailyGoalRing } from './DailyGoalRing';
import { ListeningHabitsChart } from './ListeningHabitsChart';
import { AuthorRankingsWidget } from './AuthorRankingsWidget';
import { TimeOfDayWidget } from './TimeOfDayWidget';
import { ListeningMilestonesWidget } from './ListeningMilestonesWidget';
import {
  BarChart3,
  Flame,
  Headphones,
  BookOpen,
  Calendar as CalendarIcon,
  Activity,
  Clock,
  Sparkles,
  Zap,
  Layers,
  History,
  Trash2,
  Play,
  RotateCcw,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import {
  getOverallActivitySummary,
  formatTrueDuration,
  formatTrueDurationShort,
  getReadingSessions,
  deleteReadingSession,
  clearReadingHistory,
  clearAllActivityLogs,
  getListeningVelocity,
  getTimeOfDayDistribution,
} from '../utils/activityTracker';

interface StatsViewProps {
  history: Audiobook[];
  onSelectBook?: (book: Audiobook) => void;
  onPlayBook?: (book: Audiobook) => void;
}

export const StatsView: React.FC<StatsViewProps> = ({
  history,
  onSelectBook,
  onPlayBook,
}) => {
  const [summary, setSummary] = useState(getOverallActivitySummary());
  const [sessions, setSessions] = useState<ReadingSessionRecord[]>(getReadingSessions());
  const [selectedTimeframe, setSelectedTimeframe] = useState<'all' | 'month' | 'week' | 'today'>('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const refreshAll = () => {
    setSummary(getOverallActivitySummary());
    setSessions(getReadingSessions());
  };

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 3000);
    const handleUpdate = () => refreshAll();
    window.addEventListener('libriaudio_reading_activity_updated', handleUpdate);
    window.addEventListener('libriaudio_reading_updated', handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('libriaudio_reading_activity_updated', handleUpdate);
      window.removeEventListener('libriaudio_reading_updated', handleUpdate);
    };
  }, []);

  const velocity = useMemo(() => getListeningVelocity(), [summary]);
  const timeOfDay = useMemo(() => getTimeOfDayDistribution(), [summary, sessions]);

  // Audio vs Ebook Ratio Math
  const audioSecs = summary.totalListenedSeconds;
  const readSecs = summary.totalReadSeconds;
  const totalImmersionSecs = audioSecs + readSecs;
  const audioPercentage = totalImmersionSecs > 0 ? Math.round((audioSecs / totalImmersionSecs) * 100) : 50;
  const readPercentage = 100 - audioPercentage;

  // Group sessions by date for the 14-day calendar
  const sessionsByDate = useMemo(() => {
    const map: Record<string, ReadingSessionRecord[]> = {};
    sessions.forEach((s) => {
      const date = s.date || new Date(s.endTimestamp).toISOString().split('T')[0];
      if (!map[date]) map[date] = [];
      map[date].push(s);
    });
    return map;
  }, [sessions]);

  // Calendar dates for the last 14 days
  const calendarDays = useMemo(() => {
    const days: { dateStr: string; dayNum: string; dayName: string; count: number; totalSecs: number }[] = [];
    const today = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayNum = String(d.getDate()).padStart(2, '0');
      const dayName = dayNames[d.getDay()];
      const daySessions = sessionsByDate[dateStr] || [];
      const totalSecs = daySessions.reduce((sum, s) => sum + s.durationSeconds, 0);

      days.push({
        dateStr,
        dayNum,
        dayName,
        count: daySessions.length,
        totalSecs,
      });
    }
    return days;
  }, [sessionsByDate]);

  // Filtered session list based on date click
  const visibleSessions = useMemo(() => {
    if (selectedDateFilter) {
      return sessions.filter((s) => (s.date || new Date(s.endTimestamp).toISOString().split('T')[0]) === selectedDateFilter);
    }
    return sessions.slice(0, 15);
  }, [sessions, selectedDateFilter]);

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteReadingSession(id);
    refreshAll();
  };

  const handleClearAllHistory = () => {
    clearAllActivityLogs();
    setShowClearConfirm(false);
    refreshAll();
  };

  return (
    <div id="stats-view-page" className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-serif-display italic font-bold text-[var(--text-main)] tracking-wide flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[var(--accent)]" />
            Listening & Reading Analytics
          </h1>
          <p className="text-xs text-[var(--text-dim)] font-serif-display italic mt-0.5">
            Real-time audiobook velocity, immersion ratios, and milestone achievements
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {summary.dailyStreak > 0 && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--accent-dim)] border border-[var(--accent)] text-[var(--accent)] text-xs font-mono font-bold">
              <Flame className="w-4 h-4 text-amber-400 fill-current" />
              <span>{summary.dailyStreak} Day Streak</span>
            </div>
          )}

          <button
            onClick={() => setShowClearConfirm(!showClearConfirm)}
            className="p-2 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] text-[var(--text-dim)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] text-xs transition-colors"
            title="Manage Data"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Confirmation Drawer for Resetting Stats */}
      {showClearConfirm && (
        <div className="p-4 rounded-2xl bg-red-950/20 border border-red-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="text-xs space-y-0.5">
            <p className="font-bold text-red-200">Reset Activity Statistics?</p>
            <p className="text-red-300/60 text-[11px]">
              This will clear your local true time logs, session history, and streaks.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1.5 rounded-xl bg-[var(--surface-raised)] text-[var(--text-main)] text-xs font-medium hover:bg-[var(--surface-raised)]"
            >
              Cancel
            </button>
            <button
              onClick={handleClearAllHistory}
              className="px-3 py-1.5 rounded-xl bg-red-600 text-[var(--text-main)] text-xs font-bold hover:bg-red-500 shadow-md"
            >
              Reset All
            </button>
          </div>
        </div>
      )}

      {/* Primary Key Metric Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Audiobook Time */}
        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] flex flex-col justify-between relative overflow-hidden group hover:border-[var(--accent)] transition-all">
          <div className="flex items-center justify-between text-[var(--text-dim)] text-[10px] uppercase font-semibold">
            <span>Audiobook Time</span>
            <Headphones className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="mt-3">
            <div className="text-lg sm:text-xl font-bold font-mono text-[var(--text-main)] truncate">
              {formatTrueDuration(summary.totalListenedSeconds)}
            </div>
            <p className="text-[10px] text-[var(--text-dim)] mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              {audioPercentage}% of total immersion
            </p>
          </div>
        </div>

        {/* Ebook Time */}
        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] flex flex-col justify-between relative overflow-hidden group hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between text-[var(--text-dim)] text-[10px] uppercase font-semibold">
            <span>Ebook Reading</span>
            <BookOpen className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3">
            <div className="text-lg sm:text-xl font-bold font-mono text-[var(--text-main)] truncate">
              {formatTrueDuration(summary.totalReadSeconds)}
            </div>
            <p className="text-[10px] text-[var(--text-dim)] mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              {readPercentage}% of total immersion
            </p>
          </div>
        </div>

        {/* Total Immersion */}
        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] flex flex-col justify-between relative overflow-hidden group hover:border-[var(--accent)] transition-all">
          <div className="flex items-center justify-between text-[var(--text-dim)] text-[10px] uppercase font-semibold">
            <span>Total Immersion</span>
            <Sparkles className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="mt-3">
            <div className="text-lg sm:text-xl font-bold font-mono text-[var(--accent)] truncate">
              {formatTrueDuration(summary.totalCombinedSeconds)}
            </div>
            <p className="text-[10px] text-[var(--text-dim)] mt-0.5">
              Across {summary.booksStartedCount || history.length} titles
            </p>
          </div>
        </div>

        {/* Daily Velocity */}
        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-[var(--text-dim)] text-[10px] uppercase font-semibold">
            <span>Daily Velocity</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className="text-lg sm:text-xl font-bold font-mono text-[var(--text-main)]">
              {velocity.dailyAverageMinutes}m <span className="text-xs text-[var(--text-dim)] font-sans">/ day</span>
            </div>
            <p className="text-[10px] text-emerald-400/80 mt-0.5 font-mono">
              ~{velocity.weeklyVelocityHours}h weekly pace
            </p>
          </div>
        </div>
      </div>

      {/* Audio vs Ebook Immersion Split Bar */}
      <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span className="font-semibold text-[var(--text-main)]">Immersion Format Breakdown</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="text-[var(--accent)] font-bold">🎧 {audioPercentage}% Audio</span>
            <span className="text-blue-400 font-bold">📖 {readPercentage}% Ebook</span>
          </div>
        </div>

        <div className="w-full h-2.5 bg-[var(--surface-raised)] rounded-full overflow-hidden flex p-0.5 border border-[var(--border-subtle)]">
          <div
            className="h-full bg-[var(--accent)] rounded-l-full transition-all duration-700 shadow-sm"
            style={{ width: `${Math.max(4, audioPercentage)}%` }}
            title={`Audiobook: ${audioPercentage}%`}
          />
          <div
            className="h-full bg-blue-400 rounded-r-full transition-all duration-700 shadow-sm"
            style={{ width: `${Math.max(4, readPercentage)}%` }}
            title={`Ebook: ${readPercentage}%`}
          />
        </div>
      </div>

      {/* Daily Goal Section */}
      <section id="stats-daily-goal-section">
        <DailyGoalRing />
      </section>

      {/* 7-Day Trend Chart */}
      <section id="stats-habits-chart-section">
        <ListeningHabitsChart />
      </section>

      {/* Time of Day & Velocity Distribution */}
      <section id="stats-time-of-day-section">
        <TimeOfDayWidget />
      </section>

      {/* Author Leaderboard Ranking */}
      <section id="stats-author-rankings-section">
        <AuthorRankingsWidget
          history={history}
          onSelectBook={onSelectBook}
          onPlayBook={onPlayBook}
        />
      </section>

      {/* Listening Milestones & Achievements */}
      <section id="stats-milestones-section">
        <ListeningMilestonesWidget history={history} />
      </section>

      {/* 14-Day Activity Calendar & Session History Drill-Down */}
      <section id="stats-calendar-section" className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)]">
              <CalendarIcon className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[var(--text-main)]">
                14-Day Activity Heatmap
              </h3>
              <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
                Click any day to filter your recorded reading & listening sessions
              </p>
            </div>
          </div>

          {selectedDateFilter && (
            <button
              onClick={() => setSelectedDateFilter(null)}
              className="text-[11px] text-[var(--accent)] hover:underline font-mono self-start sm:self-auto"
            >
              Clear filter ({selectedDateFilter})
            </button>
          )}
        </div>

        {/* 14-Day Grid */}
        <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5">
          {calendarDays.map((d) => {
            const isSelected = selectedDateFilter === d.dateStr;
            const hasActivity = d.count > 0;
            return (
              <button
                key={d.dateStr}
                onClick={() => setSelectedDateFilter(isSelected ? null : d.dateStr)}
                className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--accent)] text-black border-[var(--accent)] font-bold shadow-md shadow-[rgba(var(--accent-rgb),0.3)]'
                    : hasActivity
                    ? 'bg-[var(--accent-dim)] border-[var(--accent)] text-[var(--text-main)] hover:bg-[var(--accent-dim)]'
                    : 'bg-[var(--surface-raised)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:bg-[var(--surface-raised)]'
                }`}
                title={`${d.dateStr}: ${d.count} sessions (${formatTrueDurationShort(d.totalSecs)})`}
              >
                <span className={`text-[8px] font-mono uppercase ${isSelected ? 'text-black/70' : 'text-[var(--text-dim)]'}`}>
                  {d.dayName}
                </span>
                <span className="text-xs font-mono font-bold mt-0.5">
                  {d.dayNum}
                </span>
                <span
                  className={`text-[9px] font-mono mt-1 px-1 rounded ${
                    isSelected
                      ? 'bg-black/20 text-black'
                      : hasActivity
                      ? 'text-[var(--accent)] font-bold'
                      : 'text-transparent'
                  }`}
                >
                  {hasActivity ? `${d.count}` : '0'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sessions Drill-down List */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-dim)]">
            <span className="flex items-center gap-1.5 font-semibold text-[var(--text-main)]">
              <History className="w-3.5 h-3.5 text-[var(--accent)]" />
              {selectedDateFilter ? `Sessions on ${selectedDateFilter}` : 'Recent Activity Logs'}
            </span>
            <span className="text-[11px] font-mono text-[var(--text-dim)]">
              Showing {visibleSessions.length} record{visibleSessions.length !== 1 ? 's' : ''}
            </span>
          </div>

          {visibleSessions.length === 0 ? (
            <div className="text-center py-8 opacity-50 text-xs bg-[var(--surface-raised)] rounded-xl border border-[var(--border-subtle)]">
              No activity logged {selectedDateFilter ? 'for this date' : 'yet'}.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {visibleSessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] border border-[var(--border-subtle)] transition-all group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-6 h-6 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)] shrink-0">
                      {s.chapterTitle ? <BookOpen className="w-3 h-3 text-blue-400" /> : <Headphones className="w-3 h-3 text-[var(--accent)]" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-serif-display italic font-semibold text-[var(--text-main)] truncate">
                        {s.bookTitle}
                      </p>
                      <p className="text-[10px] text-[var(--text-dim)] truncate">
                        {s.chapterTitle || 'Audiobook track'} • {new Date(s.endTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono font-bold text-[var(--accent)]">
                      {formatTrueDurationShort(s.durationSeconds)}
                    </span>

                    <button
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="p-1 rounded-lg text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                      title="Remove session log"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

