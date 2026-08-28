/**
 * Dedicated persistence and cache manager for Audio & Ebook playback positions,
 * visit timestamps, and Reading/Read/Unread statuses.
 *
 * Position writes are debounced to protect disk I/O:
 *  - Audio: every 3 seconds (called ~4x/sec from onTimeUpdate)
 *  - Ebook: every 2 seconds (called on every scroll tick)
 *  - Immediate flush on visibilitychange (background) + beforeunload (close)
 */

export interface SavedAudioPosition {
  bookId: string;
  trackIndex: number;
  currentTime: number;
  duration: number;
  lastVisited: number;
  status: 'reading' | 'read' | 'unread';
}

export interface SavedEbookPosition {
  bookId: string;
  chapterIndex: number;
  scrollPercentage: number;
  lastVisited: number;
  status: 'reading' | 'read' | 'unread';
}

const STORAGE_PREFIX_AUDIO = 'libriaudio_audio_pos_';
const STORAGE_PREFIX_EBOOK = 'libriaudio_ebook_pos_';
const STORAGE_STATUS_PREFIX = 'libriaudio_status_';
const STORAGE_VISIT_PREFIX = 'libriaudio_visit_';

const AUDIO_DEBOUNCE_MS = 3000;
const EBOOK_DEBOUNCE_MS = 2000;

// --- Audio position debounce state ---

interface PendingAudio {
  bookId: string;
  trackIndex: number;
  currentTime: number;
  duration: number;
}

let pendingAudio: PendingAudio | null = null;
let audioTimer: ReturnType<typeof setTimeout> | null = null;

function commitAudioPosition(p: PendingAudio): void {
  try {
    const isCompleted = p.duration > 60 && p.currentTime >= p.duration * 0.95;
    const isStarted = p.currentTime > 10 || p.trackIndex > 0;
    const currentStatus = getBookStatus(p.bookId);

    const newStatus: 'reading' | 'read' | 'unread' = isCompleted
      ? 'read'
      : isStarted && currentStatus !== 'read'
      ? 'reading'
      : currentStatus;

    const data: SavedAudioPosition = {
      bookId: p.bookId,
      trackIndex: Math.max(0, p.trackIndex),
      currentTime: Math.max(0, p.currentTime),
      duration: Math.max(0, p.duration),
      lastVisited: Date.now(),
      status: newStatus,
    };

    localStorage.setItem(`${STORAGE_PREFIX_AUDIO}${p.bookId}`, JSON.stringify(data));
    localStorage.setItem(`${STORAGE_VISIT_PREFIX}${p.bookId}`, Date.now().toString());
    localStorage.setItem(`${STORAGE_STATUS_PREFIX}${p.bookId}`, newStatus);
    localStorage.setItem(`libriaudio_pos_${p.bookId}_${p.trackIndex}`, p.currentTime.toString());

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('libriaudio_position_updated', {
          detail: { bookId: p.bookId, trackIndex: p.trackIndex, currentTime: p.currentTime, status: newStatus },
        })
      );
    }
  } catch (e) {
    console.warn('Failed to save audio position:', e);
  }
}

/**
 * Save current audio playback position for a book (debounced).
 * Writes are batched every AUDIO_DEBOUNCE_MS. Call flushAudioPosition()
 * for an immediate write (e.g. on background/close).
 */
export function saveAudiobookPosition(
  bookId: string,
  trackIndex: number,
  currentTime: number,
  duration: number = 0
): void {
  if (!bookId) return;

  pendingAudio = { bookId, trackIndex, currentTime, duration };

  if (audioTimer === null) {
    audioTimer = setTimeout(() => {
      audioTimer = null;
      if (pendingAudio) {
        const p = pendingAudio;
        pendingAudio = null;
        commitAudioPosition(p);
      }
    }, AUDIO_DEBOUNCE_MS);
  }
}

/**
 * Immediately persist any pending audio position to disk.
 * Call this on visibilitychange (background), beforeunload (close), or pause.
 */
export function flushAudioPosition(): void {
  if (audioTimer !== null) {
    clearTimeout(audioTimer);
    audioTimer = null;
  }
  if (pendingAudio) {
    const p = pendingAudio;
    pendingAudio = null;
    commitAudioPosition(p);
  }
}

// --- Ebook position debounce state ---

interface PendingEbook {
  bookId: string;
  chapterIndex: number;
  scrollPercentage: number;
  totalChapters: number;
}

let pendingEbook: PendingEbook | null = null;
let ebookTimer: ReturnType<typeof setTimeout> | null = null;

function commitEbookPosition(p: PendingEbook): void {
  try {
    const isCompleted = p.chapterIndex >= p.totalChapters - 1 && p.scrollPercentage >= 95;
    const isStarted = p.chapterIndex > 0 || p.scrollPercentage > 5;
    const currentStatus = getBookStatus(p.bookId);

    const newStatus: 'reading' | 'read' | 'unread' = isCompleted
      ? 'read'
      : isStarted && currentStatus !== 'read'
      ? 'reading'
      : currentStatus;

    const data: SavedEbookPosition = {
      bookId: p.bookId,
      chapterIndex: Math.max(0, p.chapterIndex),
      scrollPercentage: Math.max(0, Math.min(100, p.scrollPercentage)),
      lastVisited: Date.now(),
      status: newStatus,
    };

    localStorage.setItem(`${STORAGE_PREFIX_EBOOK}${p.bookId}`, JSON.stringify(data));
    localStorage.setItem(`${STORAGE_VISIT_PREFIX}${p.bookId}`, Date.now().toString());
    localStorage.setItem(`${STORAGE_STATUS_PREFIX}${p.bookId}`, newStatus);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('libriaudio_ebook_pos_updated', {
          detail: { bookId: p.bookId, chapterIndex: p.chapterIndex, scrollPercentage: p.scrollPercentage, status: newStatus },
        })
      );
    }
  } catch (e) {
    console.warn('Failed to save ebook position:', e);
  }
}

/**
 * Save ebook reading position (debounced).
 * Writes are batched every EBOOK_DEBOUNCE_MS. Call flushEbookPosition()
 * for an immediate write.
 */
export function saveEbookPosition(
  bookId: string,
  chapterIndex: number,
  scrollPercentage: number,
  totalChapters: number = 1
): void {
  if (!bookId) return;

  pendingEbook = { bookId, chapterIndex, scrollPercentage, totalChapters };

  if (ebookTimer === null) {
    ebookTimer = setTimeout(() => {
      ebookTimer = null;
      if (pendingEbook) {
        const p = pendingEbook;
        pendingEbook = null;
        commitEbookPosition(p);
      }
    }, EBOOK_DEBOUNCE_MS);
  }
}

/**
 * Immediately persist any pending ebook position to disk.
 */
export function flushEbookPosition(): void {
  if (ebookTimer !== null) {
    clearTimeout(ebookTimer);
    ebookTimer = null;
  }
  if (pendingEbook) {
    const p = pendingEbook;
    pendingEbook = null;
    commitEbookPosition(p);
  }
}

// --- Lifecycle flush handlers ---

let flushHandlersRegistered = false;

/**
 * Register visibilitychange + beforeunload listeners that flush
 * pending positions immediately. Safe to call multiple times (idempotent).
 */
export function initPositionFlushHandlers(): void {
  if (flushHandlersRegistered) return;
  flushHandlersRegistered = true;

  if (typeof document === 'undefined') return;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushAudioPosition();
      flushEbookPosition();
    }
  });

  window.addEventListener('beforeunload', () => {
    flushAudioPosition();
    flushEbookPosition();
  });
}

// --- Read helpers (unchanged) ---

export function getAudiobookPosition(bookId: string): SavedAudioPosition | null {
  if (!bookId) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX_AUDIO}${bookId}`);
    if (raw) return JSON.parse(raw);

    for (let i = 0; i < 50; i++) {
      const legacyPos = localStorage.getItem(`libriaudio_pos_${bookId}_${i}`);
      if (legacyPos) {
        const time = parseFloat(legacyPos);
        if (!isNaN(time) && time > 0) {
          return {
            bookId,
            trackIndex: i,
            currentTime: time,
            duration: 0,
            lastVisited: Date.now(),
            status: 'reading',
          };
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function getEbookPosition(bookId: string): SavedEbookPosition | null {
  if (!bookId) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX_EBOOK}${bookId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

export function getBookStatus(bookId: string): 'reading' | 'read' | 'unread' {
  if (!bookId) return 'unread';
  try {
    const saved = localStorage.getItem(`${STORAGE_STATUS_PREFIX}${bookId}`);
    if (saved === 'reading' || saved === 'read' || saved === 'unread') return saved;

    const audioPos = getAudiobookPosition(bookId);
    if (audioPos && (audioPos.currentTime > 10 || audioPos.trackIndex > 0)) {
      return audioPos.status || 'reading';
    }
    const ebookPos = getEbookPosition(bookId);
    if (ebookPos && (ebookPos.scrollPercentage > 5 || ebookPos.chapterIndex > 0)) {
      return ebookPos.status || 'reading';
    }
  } catch {
    // ignore
  }
  return 'unread';
}

export function setBookStatus(bookId: string, status: 'reading' | 'read' | 'unread'): void {
  if (!bookId) return;
  try {
    localStorage.setItem(`${STORAGE_STATUS_PREFIX}${bookId}`, status);
    localStorage.setItem(`${STORAGE_VISIT_PREFIX}${bookId}`, Date.now().toString());
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('libriaudio_status_changed', { detail: { bookId, status } })
      );
    }
  } catch (e) {
    console.warn('Failed to set book status:', e);
  }
}

export function getBookLastVisited(bookId: string): number {
  if (!bookId) return 0;
  try {
    const val = localStorage.getItem(`${STORAGE_VISIT_PREFIX}${bookId}`);
    if (val) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return 0;
}

export function touchBookVisited(bookId: string): void {
  if (!bookId) return;
  try {
    localStorage.setItem(`${STORAGE_VISIT_PREFIX}${bookId}`, Date.now().toString());
  } catch {
    // ignore
  }
}
