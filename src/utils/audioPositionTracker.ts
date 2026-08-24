/**
 * Dedicated persistence and cache manager for Audio & Ebook playback positions,
 * visit timestamps, and Reading/Read/Unread statuses.
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

/**
 * Save current audio playback position for a book
 */
export function saveAudiobookPosition(
  bookId: string,
  trackIndex: number,
  currentTime: number,
  duration: number = 0
): void {
  if (!bookId) return;
  try {
    const isCompleted = duration > 60 && currentTime >= duration * 0.95;
    const isStarted = currentTime > 10 || trackIndex > 0;
    const currentStatus = getBookStatus(bookId);

    const newStatus: 'reading' | 'read' | 'unread' = isCompleted
      ? 'read'
      : isStarted && currentStatus !== 'read'
      ? 'reading'
      : currentStatus;

    const data: SavedAudioPosition = {
      bookId,
      trackIndex: Math.max(0, trackIndex),
      currentTime: Math.max(0, currentTime),
      duration: Math.max(0, duration),
      lastVisited: Date.now(),
      status: newStatus,
    };

    localStorage.setItem(`${STORAGE_PREFIX_AUDIO}${bookId}`, JSON.stringify(data));
    localStorage.setItem(`${STORAGE_VISIT_PREFIX}${bookId}`, Date.now().toString());
    localStorage.setItem(`${STORAGE_STATUS_PREFIX}${bookId}`, newStatus);

    // Also backward compatibility key
    localStorage.setItem(`libriaudio_pos_${bookId}_${trackIndex}`, currentTime.toString());

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('libriaudio_position_updated', {
          detail: { bookId, trackIndex, currentTime, status: newStatus },
        })
      );
    }
  } catch (e) {
    console.warn('Failed to save audio position:', e);
  }
}

/**
 * Retrieve saved audio playback position for a book
 */
export function getAudiobookPosition(bookId: string): SavedAudioPosition | null {
  if (!bookId) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX_AUDIO}${bookId}`);
    if (raw) {
      return JSON.parse(raw);
    }
    // Fallback check legacy keys
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

/**
 * Save ebook reading position
 */
export function saveEbookPosition(
  bookId: string,
  chapterIndex: number,
  scrollPercentage: number,
  totalChapters: number = 1
): void {
  if (!bookId) return;
  try {
    const isCompleted = chapterIndex >= totalChapters - 1 && scrollPercentage >= 95;
    const isStarted = chapterIndex > 0 || scrollPercentage > 5;
    const currentStatus = getBookStatus(bookId);

    const newStatus: 'reading' | 'read' | 'unread' = isCompleted
      ? 'read'
      : isStarted && currentStatus !== 'read'
      ? 'reading'
      : currentStatus;

    const data: SavedEbookPosition = {
      bookId,
      chapterIndex: Math.max(0, chapterIndex),
      scrollPercentage: Math.max(0, Math.min(100, scrollPercentage)),
      lastVisited: Date.now(),
      status: newStatus,
    };

    localStorage.setItem(`${STORAGE_PREFIX_EBOOK}${bookId}`, JSON.stringify(data));
    localStorage.setItem(`${STORAGE_VISIT_PREFIX}${bookId}`, Date.now().toString());
    localStorage.setItem(`${STORAGE_STATUS_PREFIX}${bookId}`, newStatus);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('libriaudio_ebook_pos_updated', {
          detail: { bookId, chapterIndex, scrollPercentage, status: newStatus },
        })
      );
    }
  } catch (e) {
    console.warn('Failed to save ebook position:', e);
  }
}

/**
 * Retrieve saved ebook position
 */
export function getEbookPosition(bookId: string): SavedEbookPosition | null {
  if (!bookId) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX_EBOOK}${bookId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Get book status ('reading' | 'read' | 'unread')
 */
export function getBookStatus(bookId: string): 'reading' | 'read' | 'unread' {
  if (!bookId) return 'unread';
  try {
    const saved = localStorage.getItem(`${STORAGE_STATUS_PREFIX}${bookId}`);
    if (saved === 'reading' || saved === 'read' || saved === 'unread') {
      return saved;
    }
    // Check if audio or ebook has reading progress
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

/**
 * Manually update book status
 */
export function setBookStatus(bookId: string, status: 'reading' | 'read' | 'unread'): void {
  if (!bookId) return;
  try {
    localStorage.setItem(`${STORAGE_STATUS_PREFIX}${bookId}`, status);
    localStorage.setItem(`${STORAGE_VISIT_PREFIX}${bookId}`, Date.now().toString());

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('libriaudio_status_changed', {
          detail: { bookId, status },
        })
      );
    }
  } catch (e) {
    console.warn('Failed to set book status:', e);
  }
}

/**
 * Get last visited timestamp for a book
 */
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

/**
 * Touch book last visited timestamp
 */
export function touchBookVisited(bookId: string): void {
  if (!bookId) return;
  try {
    localStorage.setItem(`${STORAGE_VISIT_PREFIX}${bookId}`, Date.now().toString());
  } catch {
    // ignore
  }
}
