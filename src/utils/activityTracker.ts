import { Audiobook, ReadingSessionRecord } from '../types';

export interface BookActivity {
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  coverImageUrl?: string;
  trueListenedSeconds: number;
  trueReadSeconds: number;
  firstInteractedAt: number;
  lastInteractedAt: number;
  lastListenTimestamp?: number;
  lastReadTimestamp?: number;
  currentTrackIndex?: number;
  currentTrackTitle?: string;
  currentAudioTime?: number;
  lastReadChapterIndex?: number;
  lastReadChapterTitle?: string;
  lastScrollPercentage?: number;
  totalChapters?: number;
}

export interface DailyActivityLog {
  date: string; // YYYY-MM-DD
  listenedSeconds: number;
  readSeconds: number;
}

export interface ActivityDatabase {
  books: Record<string, BookActivity>;
  dailyLogs: Record<string, DailyActivityLog>;
  readingSessions: ReadingSessionRecord[];
}

const STORAGE_KEY = 'libriaudio_true_activity_v1';
const SESSIONS_STORAGE_KEY = 'libriaudio_reading_sessions_v1';

function getTodayKey(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function loadActivityDb(): ActivityDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const rawSessions = localStorage.getItem(SESSIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const sessions = rawSessions ? JSON.parse(rawSessions) : [];

    return {
      books: parsed.books || {},
      dailyLogs: parsed.dailyLogs || {},
      readingSessions: Array.isArray(sessions) ? sessions : [],
    };
  } catch (e) {
    console.warn('Failed to load activity db:', e);
  }
  return { books: {}, dailyLogs: {}, readingSessions: [] };
}

let memoryDb: ActivityDatabase = loadActivityDb();
let dirty = false;

// Periodic flush to LocalStorage
if (typeof window !== 'undefined') {
  setInterval(() => {
    if (dirty) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ books: memoryDb.books, dailyLogs: memoryDb.dailyLogs })
        );
        localStorage.setItem(
          SESSIONS_STORAGE_KEY,
          JSON.stringify(memoryDb.readingSessions || [])
        );
        dirty = false;
      } catch (e) {
        console.warn('Failed to save activity db:', e);
      }
    }
  }, 2000);

  window.addEventListener('beforeunload', () => {
    if (dirty) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ books: memoryDb.books, dailyLogs: memoryDb.dailyLogs })
        );
        localStorage.setItem(
          SESSIONS_STORAGE_KEY,
          JSON.stringify(memoryDb.readingSessions || [])
        );
        dirty = false;
      } catch (e) {
        console.warn('Failed to save activity db on exit:', e);
      }
    }
  });
}

/**
 * Record exact reading session (duration, book, chapter, timestamp)
 */
export function recordReadingSession(
  sessionData: Omit<ReadingSessionRecord, 'id' | 'date'> & { date?: string }
): ReadingSessionRecord {
  const today = sessionData.date || getTodayKey();
  const session: ReadingSessionRecord = {
    id: `rs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    date: today,
    ...sessionData,
  };

  if (!memoryDb.readingSessions) {
    memoryDb.readingSessions = [];
  }

  // Check if we can merge with a very recent session for the same book and chapter (< 60s ago)
  const lastSession = memoryDb.readingSessions[0];
  if (
    lastSession &&
    lastSession.bookId === session.bookId &&
    lastSession.chapterIndex === session.chapterIndex &&
    session.startTimestamp - lastSession.endTimestamp < 60000
  ) {
    lastSession.durationSeconds += session.durationSeconds;
    lastSession.endTimestamp = session.endTimestamp;
    if (session.scrollPercentage !== undefined) {
      lastSession.scrollPercentage = session.scrollPercentage;
    }
  } else {
    // Insert at front
    memoryDb.readingSessions.unshift(session);
    // Keep max 200 sessions
    if (memoryDb.readingSessions.length > 200) {
      memoryDb.readingSessions = memoryDb.readingSessions.slice(0, 200);
    }
  }

  dirty = true;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('libriaudio_reading_activity_updated', {
        detail: { bookId: session.bookId, session },
      })
    );
  }

  return session;
}

/**
 * Get all reading history sessions
 */
export function getReadingSessions(): ReadingSessionRecord[] {
  return [...(memoryDb.readingSessions || [])];
}

/**
 * Clear all reading sessions history
 */
export function clearReadingHistory(): void {
  memoryDb.readingSessions = [];
  dirty = true;
  try {
    localStorage.removeItem(SESSIONS_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear sessions storage', e);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('libriaudio_reading_updated'));
  }
}

/**
 * Delete a specific reading session by ID
 */
export function deleteReadingSession(sessionId: string): void {
  memoryDb.readingSessions = (memoryDb.readingSessions || []).filter((s) => s.id !== sessionId);
  dirty = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('libriaudio_reading_updated'));
  }
}

/**
 * Get reading history sessions for a specific book
 */
export function getReadingSessionsForBook(bookId: string): ReadingSessionRecord[] {
  return (memoryDb.readingSessions || []).filter((s) => s.bookId === bookId);
}

/**
 * Record true listening time in seconds
 */
export function recordTrueListeningTime(
  book: Audiobook,
  seconds: number,
  trackIndex?: number,
  trackTitle?: string,
  audioCurrentTime?: number
): void {
  if (!book || seconds <= 0) return;
  const now = Date.now();
  const today = getTodayKey();

  if (!memoryDb.books[book.id]) {
    memoryDb.books[book.id] = {
      bookId: book.id,
      bookTitle: book.title,
      bookAuthor: book.author,
      coverImageUrl: book.coverImageUrl,
      trueListenedSeconds: 0,
      trueReadSeconds: 0,
      firstInteractedAt: now,
      lastInteractedAt: now,
      totalChapters: book.tracks?.length || 1,
    };
  }

  const record = memoryDb.books[book.id];
  record.trueListenedSeconds += seconds;
  record.lastInteractedAt = now;
  record.lastListenTimestamp = now;
  if (trackIndex !== undefined) record.currentTrackIndex = trackIndex;
  if (trackTitle) record.currentTrackTitle = trackTitle;
  if (audioCurrentTime !== undefined) record.currentAudioTime = audioCurrentTime;
  if (book.coverImageUrl) record.coverImageUrl = book.coverImageUrl;

  // Daily log
  if (!memoryDb.dailyLogs[today]) {
    memoryDb.dailyLogs[today] = { date: today, listenedSeconds: 0, readSeconds: 0 };
  }
  memoryDb.dailyLogs[today].listenedSeconds += seconds;

  dirty = true;
}

/**
 * Record true reading time in seconds
 */
export function recordTrueReadingTime(
  book: Audiobook,
  seconds: number,
  chapterIndex?: number,
  chapterTitle?: string,
  scrollPercentage?: number
): void {
  if (!book || seconds <= 0) return;
  const now = Date.now();
  const today = getTodayKey();

  if (!memoryDb.books[book.id]) {
    memoryDb.books[book.id] = {
      bookId: book.id,
      bookTitle: book.title,
      bookAuthor: book.author,
      coverImageUrl: book.coverImageUrl,
      trueListenedSeconds: 0,
      trueReadSeconds: 0,
      firstInteractedAt: now,
      lastInteractedAt: now,
      totalChapters: book.ebookChapters?.length || book.tracks?.length || 1,
    };
  }

  const record = memoryDb.books[book.id];
  record.trueReadSeconds += seconds;
  record.lastInteractedAt = now;
  record.lastReadTimestamp = now;
  if (chapterIndex !== undefined) record.lastReadChapterIndex = chapterIndex;
  if (chapterTitle) record.lastReadChapterTitle = chapterTitle;
  if (scrollPercentage !== undefined) record.lastScrollPercentage = scrollPercentage;
  if (book.coverImageUrl) record.coverImageUrl = book.coverImageUrl;

  // Daily log
  if (!memoryDb.dailyLogs[today]) {
    memoryDb.dailyLogs[today] = { date: today, listenedSeconds: 0, readSeconds: 0 };
  }
  memoryDb.dailyLogs[today].readSeconds += seconds;

  dirty = true;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('libriaudio_reading_activity_updated', {
        detail: { bookId: book.id, readSeconds: seconds },
      })
    );
  }
}

/**
 * Get activity record for a specific book
 */
export function getBookActivity(bookId: string): BookActivity | null {
  return memoryDb.books[bookId] || null;
}

/**
 * Get all books activity list sorted by most recent
 */
export function getAllBookActivities(): BookActivity[] {
  return Object.values(memoryDb.books).sort((a, b) => b.lastInteractedAt - a.lastInteractedAt);
}

/**
 * Get overall summary stats
 */
export function getOverallActivitySummary(): {
  totalListenedSeconds: number;
  totalReadSeconds: number;
  totalCombinedSeconds: number;
  booksStartedCount: number;
  dailyStreak: number;
  dailyLogs: DailyActivityLog[];
} {
  const books = Object.values(memoryDb.books);
  const totalListenedSeconds = books.reduce((acc, b) => acc + (b.trueListenedSeconds || 0), 0);
  const totalReadSeconds = books.reduce((acc, b) => acc + (b.trueReadSeconds || 0), 0);
  const totalCombinedSeconds = totalListenedSeconds + totalReadSeconds;

  // Calculate day streak
  const logs = Object.values(memoryDb.dailyLogs).sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const log = memoryDb.dailyLogs[dateStr];
    if (log && (log.listenedSeconds > 0 || log.readSeconds > 0)) {
      streak++;
    } else if (i === 0) {
      // today hasn't happened yet or no activity today yet, check yesterday
      continue;
    } else {
      break;
    }
  }

  return {
    totalListenedSeconds,
    totalReadSeconds,
    totalCombinedSeconds,
    booksStartedCount: books.length,
    dailyStreak: streak,
    dailyLogs: logs,
  };
}

/**
 * Get daily activity for a specific date (YYYY-MM-DD)
 */
export function getDailyActivity(dateStr: string): DailyActivityLog {
  return memoryDb.dailyLogs[dateStr] || { date: dateStr, listenedSeconds: 0, readSeconds: 0 };
}

/**
 * Get last 7 days of activity logs
 */
export function getLast7DaysActivity(): {
  date: string;
  dayName: string;
  listenedMins: number;
  readMins: number;
  totalMins: number;
}[] {
  const days: {
    date: string;
    dayName: string;
    listenedMins: number;
    readMins: number;
    totalMins: number;
  }[] = [];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = dayNames[d.getDay()];

    const log = getDailyActivity(dateStr);
    const listenedMins = Math.round(log.listenedSeconds / 60);
    const readMins = Math.round(log.readSeconds / 60);

    days.push({
      date: dateStr,
      dayName,
      listenedMins,
      readMins,
      totalMins: listenedMins + readMins,
    });
  }

  return days;
}

/**
 * Format duration in human friendly string (e.g. "2h 45m" or "32m")
 */
export function formatTrueDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs > 0 ? `${secs}s` : ''}`;
  return `${secs}s`;
}

/**
 * Format duration in short human friendly string (e.g. "2h", "45m", "30s")
 */
export function formatTrueDurationShort(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (hrs > 0) return `${hrs}h`;
  if (mins > 0) return `${mins}m`;
  return `${Math.floor(seconds)}s`;
}

export interface TimeOfDayDistribution {
  morningMins: number; // 6:00 - 12:00
  afternoonMins: number; // 12:00 - 18:00
  eveningMins: number; // 18:00 - 22:00
  nightMins: number; // 22:00 - 6:00
  morningPercent: number;
  afternoonPercent: number;
  eveningPercent: number;
  nightPercent: number;
  peakPeriod: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
}

/**
 * Calculate Time of Day listening breakdown
 */
export function getTimeOfDayDistribution(): TimeOfDayDistribution {
  let morningSecs = 0;
  let afternoonSecs = 0;
  let eveningSecs = 0;
  let nightSecs = 0;

  const sessions = memoryDb.readingSessions || [];
  if (sessions.length > 0) {
    sessions.forEach((s) => {
      const hour = new Date(s.startTimestamp || s.endTimestamp).getHours();
      const dur = s.durationSeconds || 0;
      if (hour >= 6 && hour < 12) {
        morningSecs += dur;
      } else if (hour >= 12 && hour < 18) {
        afternoonSecs += dur;
      } else if (hour >= 18 && hour < 22) {
        eveningSecs += dur;
      } else {
        nightSecs += dur;
      }
    });
  }

  // Also factor in book activities
  Object.values(memoryDb.books).forEach((b) => {
    if (b.lastListenTimestamp) {
      const hour = new Date(b.lastListenTimestamp).getHours();
      const weight = Math.min(b.trueListenedSeconds || 0, 1800);
      if (hour >= 6 && hour < 12) morningSecs += weight * 0.3;
      else if (hour >= 12 && hour < 18) afternoonSecs += weight * 0.3;
      else if (hour >= 18 && hour < 22) eveningSecs += weight * 0.3;
      else nightSecs += weight * 0.3;
    }
  });

  const total = morningSecs + afternoonSecs + eveningSecs + nightSecs || 1;
  const morningPercent = Math.round((morningSecs / total) * 100);
  const afternoonPercent = Math.round((afternoonSecs / total) * 100);
  const eveningPercent = Math.round((eveningSecs / total) * 100);
  const nightPercent = Math.max(0, 100 - (morningPercent + afternoonPercent + eveningPercent));

  let peakPeriod: 'Morning' | 'Afternoon' | 'Evening' | 'Night' = 'Evening';
  const max = Math.max(morningSecs, afternoonSecs, eveningSecs, nightSecs);
  if (max === morningSecs) peakPeriod = 'Morning';
  else if (max === afternoonSecs) peakPeriod = 'Afternoon';
  else if (max === eveningSecs) peakPeriod = 'Evening';
  else peakPeriod = 'Night';

  return {
    morningMins: Math.round(morningSecs / 60),
    afternoonMins: Math.round(afternoonSecs / 60),
    eveningMins: Math.round(eveningSecs / 60),
    nightMins: Math.round(nightSecs / 60),
    morningPercent,
    afternoonPercent,
    eveningPercent,
    nightPercent,
    peakPeriod,
  };
}

export interface ListeningMilestone {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progressPercent: number;
  currentValue: string;
  targetValue: string;
  unlockedDate?: string;
}

/**
 * Evaluate all user listening milestones and achievement badges
 */
export function getListeningMilestones(historyBooks: Audiobook[] = []): ListeningMilestone[] {
  const summary = getOverallActivitySummary();
  const listenedHours = summary.totalListenedSeconds / 3600;
  const readHours = summary.totalReadSeconds / 3600;
  const totalHours = summary.totalCombinedSeconds / 3600;
  const streak = summary.dailyStreak;
  const booksCount = summary.booksStartedCount || historyBooks.length;
  const timeOfDay = getTimeOfDayDistribution();

  return [
    {
      id: 'first_play',
      title: 'First Melody',
      description: 'Start listening to your first classic audiobook',
      icon: '🎵',
      unlocked: summary.totalListenedSeconds > 30,
      progressPercent: Math.min(100, Math.round((summary.totalListenedSeconds / 30) * 100)),
      currentValue: `${Math.min(30, Math.round(summary.totalListenedSeconds))}s`,
      targetValue: '30s',
    },
    {
      id: 'golden_ear',
      title: 'Golden Ear',
      description: 'Complete 1 hour of active audiobook listening',
      icon: '🎧',
      unlocked: listenedHours >= 1.0,
      progressPercent: Math.min(100, Math.round((listenedHours / 1.0) * 100)),
      currentValue: `${listenedHours.toFixed(1)}h`,
      targetValue: '1.0h',
    },
    {
      id: 'deep_diver',
      title: 'Deep Immersion',
      description: 'Reach 5 hours of total audio and reading time',
      icon: '🌊',
      unlocked: totalHours >= 5.0,
      progressPercent: Math.min(100, Math.round((totalHours / 5.0) * 100)),
      currentValue: `${totalHours.toFixed(1)}h`,
      targetValue: '5.0h',
    },
    {
      id: 'streak_enthusiast',
      title: 'Patience & Habit',
      description: 'Maintain a 3-day continuous listening streak',
      icon: '🔥',
      unlocked: streak >= 3,
      progressPercent: Math.min(100, Math.round((streak / 3) * 100)),
      currentValue: `${streak} days`,
      targetValue: '3 days',
    },
    {
      id: 'multi_modalist',
      title: 'Multi-Modal Scholar',
      description: 'Engage with both Audiobooks and Ebooks in the app',
      icon: '✨',
      unlocked: summary.totalListenedSeconds > 60 && summary.totalReadSeconds > 60,
      progressPercent:
        summary.totalListenedSeconds > 0 && summary.totalReadSeconds > 0
          ? 100
          : summary.totalListenedSeconds > 0 || summary.totalReadSeconds > 0
          ? 50
          : 0,
      currentValue:
        summary.totalListenedSeconds > 60 && summary.totalReadSeconds > 60 ? 'Completed' : 'Partial',
      targetValue: 'Audio + Text',
    },
    {
      id: 'night_owl',
      title: 'Bedtime Wanderer',
      description: 'Log listening sessions late into the evening or night',
      icon: '🌙',
      unlocked: timeOfDay.nightMins > 10 || timeOfDay.eveningMins > 20,
      progressPercent: Math.min(
        100,
        Math.round(((timeOfDay.nightMins + timeOfDay.eveningMins) / 30) * 100)
      ),
      currentValue: `${timeOfDay.nightMins + timeOfDay.eveningMins}m`,
      targetValue: '30m Night',
    },
    {
      id: 'library_collector',
      title: 'Literary Explorer',
      description: 'Explore and start 3 or more distinctive literary works',
      icon: '📚',
      unlocked: booksCount >= 3,
      progressPercent: Math.min(100, Math.round((booksCount / 3) * 100)),
      currentValue: `${booksCount} books`,
      targetValue: '3 books',
    },
    {
      id: 'master_marathoner',
      title: 'Audio Marathoner',
      description: 'Log over 10 hours of immersive audiobook listening',
      icon: '🏆',
      unlocked: listenedHours >= 10.0,
      progressPercent: Math.min(100, Math.round((listenedHours / 10.0) * 100)),
      currentValue: `${listenedHours.toFixed(1)}h`,
      targetValue: '10h',
    },
  ];
}

/**
 * Calculate listening pace and daily velocity
 */
export function getListeningVelocity(): {
  dailyAverageMinutes: number;
  weeklyVelocityHours: number;
  mostActiveDay: string;
  projectedMonthlyHours: number;
} {
  const summary = getOverallActivitySummary();
  const recent7 = getLast7DaysActivity();
  const total7DaysMins = recent7.reduce((sum, d) => sum + d.listenedMins, 0);
  const dailyAverageMinutes = Math.round(total7DaysMins / 7);
  const weeklyVelocityHours = parseFloat((total7DaysMins / 60).toFixed(1));
  const projectedMonthlyHours = parseFloat(((dailyAverageMinutes * 30) / 60).toFixed(1));

  let mostActiveDay = 'Sunday';
  let maxMins = -1;
  recent7.forEach((d) => {
    if (d.listenedMins > maxMins) {
      maxMins = d.listenedMins;
      mostActiveDay = d.dayName;
    }
  });

  return {
    dailyAverageMinutes,
    weeklyVelocityHours,
    mostActiveDay,
    projectedMonthlyHours,
  };
}

/**
 * Clear or reset all true activity tracking & reading history
 */
export function clearAllActivityLogs(): void {
  memoryDb = { books: {}, dailyLogs: {}, readingSessions: [] };
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SESSIONS_STORAGE_KEY);
  dirty = false;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('libriaudio_reading_activity_updated', { detail: {} }));
  }
}

export interface AuthorRanking {
  author: string;
  totalSeconds: number;
  listenedSeconds: number;
  readSeconds: number;
  booksCount: number;
  books: {
    id: string;
    title: string;
    coverImageUrl?: string;
    seconds: number;
    listenedSeconds: number;
    readSeconds: number;
  }[];
  percentageOfTotal: number;
  rank: number;
}

/**
 * Clean and standardize author names (e.g. "Dostoyevsky, Fyodor" -> "Fyodor Dostoyevsky")
 */
export function normalizeAuthorName(raw: string): string {
  if (!raw) return 'Unknown Author';
  let clean = raw.trim();
  clean = clean.replace(/\(\s*\d{3,4}\s*-\s*\d{3,4}\s*\)/g, '').trim();
  clean = clean.replace(/\(\s*\d{3,4}\s*-\s*\)/g, '').trim();

  if (clean.includes(',') && !clean.toLowerCase().includes('various') && !clean.toLowerCase().includes('librivox')) {
    const parts = clean.split(',').map((p) => p.trim());
    if (parts.length === 2) {
      clean = `${parts[1]} ${parts[0]}`;
    }
  }

  return clean;
}

/**
 * Calculate and rank authors by how long the user has listened / read them
 */
export function getAuthorRankings(historyFallback?: Audiobook[]): AuthorRanking[] {
  const authorMap: Record<
    string,
    {
      author: string;
      listenedSeconds: number;
      readSeconds: number;
      booksMap: Map<string, { id: string; title: string; coverImageUrl?: string; listenedSeconds: number; readSeconds: number }>;
    }
  > = {};

  // 1. Ingest tracked activities
  Object.values(memoryDb.books).forEach((bookActivity) => {
    const normAuthor = normalizeAuthorName(bookActivity.bookAuthor || 'Classic Author');
    if (!authorMap[normAuthor]) {
      authorMap[normAuthor] = {
        author: normAuthor,
        listenedSeconds: 0,
        readSeconds: 0,
        booksMap: new Map(),
      };
    }

    const item = authorMap[normAuthor];
    const listened = bookActivity.trueListenedSeconds || 0;
    const read = bookActivity.trueReadSeconds || 0;

    item.listenedSeconds += listened;
    item.readSeconds += read;

    const existingBook = item.booksMap.get(bookActivity.bookId);
    if (existingBook) {
      existingBook.listenedSeconds += listened;
      existingBook.readSeconds += read;
      if (bookActivity.coverImageUrl) existingBook.coverImageUrl = bookActivity.coverImageUrl;
    } else {
      item.booksMap.set(bookActivity.bookId, {
        id: bookActivity.bookId,
        title: bookActivity.bookTitle,
        coverImageUrl: bookActivity.coverImageUrl,
        listenedSeconds: listened,
        readSeconds: read,
      });
    }
  });

  // 2. Fallback history books
  if (historyFallback && historyFallback.length > 0) {
    historyFallback.forEach((hBook, idx) => {
      const normAuthor = normalizeAuthorName(hBook.author);
      if (!authorMap[normAuthor]) {
        authorMap[normAuthor] = {
          author: normAuthor,
          listenedSeconds: 0,
          readSeconds: 0,
          booksMap: new Map(),
        };
      }

      const item = authorMap[normAuthor];
      if (!item.booksMap.has(hBook.id)) {
        const seedSecs = Math.max(300, Math.floor((hBook.totalTimeSecs || 1800) * 0.15) / (idx + 1));
        item.listenedSeconds += seedSecs;
        item.booksMap.set(hBook.id, {
          id: hBook.id,
          title: hBook.title,
          coverImageUrl: hBook.coverImageUrl,
          listenedSeconds: seedSecs,
          readSeconds: 0,
        });
      }
    });
  }

  // 3. Convert map to ranked list
  const authorsList = Object.values(authorMap).map((entry) => {
    const totalSeconds = entry.listenedSeconds + entry.readSeconds;
    const books = Array.from(entry.booksMap.values()).map((b) => ({
      id: b.id,
      title: b.title,
      coverImageUrl: b.coverImageUrl,
      seconds: b.listenedSeconds + b.readSeconds,
      listenedSeconds: b.listenedSeconds,
      readSeconds: b.readSeconds,
    })).sort((a, b) => b.seconds - a.seconds);

    return {
      author: entry.author,
      totalSeconds,
      listenedSeconds: entry.listenedSeconds,
      readSeconds: entry.readSeconds,
      booksCount: books.length,
      books,
      percentageOfTotal: 0,
      rank: 1,
    };
  });

  const filtered = authorsList.filter((a) => a.totalSeconds > 0);
  filtered.sort((a, b) => b.totalSeconds - a.totalSeconds);
  const totalAllAuthorsSeconds = filtered.reduce((acc, a) => acc + a.totalSeconds, 0);

  return filtered.map((a, idx) => ({
    ...a,
    rank: idx + 1,
    percentageOfTotal: totalAllAuthorsSeconds > 0 ? Math.round((a.totalSeconds / totalAllAuthorsSeconds) * 100) : 0,
  }));
}
