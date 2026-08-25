import { getOverallActivitySummary } from './activityTracker';

const GOAL_STORAGE_KEY = 'libriaudio_daily_listening_goal_mins';
const DEFAULT_GOAL_MINS = 30;

export const GOAL_PRESETS = [15, 30, 45, 60, 90, 120];

export interface DailyGoalProgress {
  goalMinutes: number;
  listenedMinutes: number;
  listenedSeconds: number;
  readMinutes: number;
  readSeconds: number;
  totalMinutes: number;
  percentage: number;
  isGoalAchieved: boolean;
  remainingMinutes: number;
  dailyStreak: number;
}

/**
 * Get daily goal target in minutes
 */
export function getDailyGoalMinutes(): number {
  try {
    const raw = localStorage.getItem(GOAL_STORAGE_KEY);
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (Number.isFinite(parsed) && parsed > 0 && parsed <= 720) {
        return parsed;
      }
    }
  } catch (e) {}
  return DEFAULT_GOAL_MINS;
}

/**
 * Set daily goal target in minutes
 */
export function setDailyGoalMinutes(minutes: number): number {
  const sanitized = Math.max(5, Math.min(720, Math.round(minutes)));
  try {
    localStorage.setItem(GOAL_STORAGE_KEY, String(sanitized));
  } catch (e) {}

  window.dispatchEvent(
    new CustomEvent('libriaudio-goal-changed', { detail: { goalMinutes: sanitized } })
  );
  return sanitized;
}

/**
 * Calculate progress towards today's daily listening goal
 */
export function getTodayGoalProgress(): DailyGoalProgress {
  const goalMinutes = getDailyGoalMinutes();
  const summary = getOverallActivitySummary();

  const todayStr = new Date().toISOString().split('T')[0];
  const todayLog = summary.dailyLogs.find((l) => l.date === todayStr);

  const listenedSeconds = Number.isFinite(todayLog?.listenedSeconds) ? todayLog!.listenedSeconds : 0;
  const readSeconds = Number.isFinite(todayLog?.readSeconds) ? todayLog!.readSeconds : 0;

  const listenedMinutes = Number.isFinite(listenedSeconds / 60) ? parseFloat((listenedSeconds / 60).toFixed(1)) : 0;
  const readMinutes = Number.isFinite(readSeconds / 60) ? parseFloat((readSeconds / 60).toFixed(1)) : 0;
  const totalMinutes = Number.isFinite((listenedSeconds + readSeconds) / 60)
    ? parseFloat(((listenedSeconds + readSeconds) / 60).toFixed(1))
    : 0;

  const rawPercent = goalMinutes > 0 ? (listenedMinutes / goalMinutes) * 100 : 0;
  const percentage = Math.min(100, Math.round(Number.isFinite(rawPercent) ? rawPercent : 0));
  const isGoalAchieved = listenedMinutes >= goalMinutes;
  const remainingMinutes = Math.max(0, parseFloat((goalMinutes - listenedMinutes).toFixed(1)) || 0);

  return {
    goalMinutes,
    listenedMinutes,
    listenedSeconds,
    readMinutes,
    readSeconds,
    totalMinutes,
    percentage,
    isGoalAchieved,
    remainingMinutes,
    dailyStreak: summary.dailyStreak,
  };
}
