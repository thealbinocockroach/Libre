import { Audiobook, AudioTrack, OfflineBookData, OfflineEbookData, EbookChapter } from '../types';
import { resolveFullTracklist } from './librivoxRecommendations';

const DB_NAME = 'LibriAudio_Offline_DB';
const DB_VERSION = 2; // Incremented for offline_ebooks store
const STORE_BOOKS = 'offline_books';
const STORE_TRACKS = 'offline_tracks';
const STORE_EBOOKS = 'offline_ebooks';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this browser environment.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_BOOKS)) {
        db.createObjectStore(STORE_BOOKS, { keyPath: 'bookId' });
      }
      if (!db.objectStoreNames.contains(STORE_TRACKS)) {
        db.createObjectStore(STORE_TRACKS, { keyPath: 'trackKey' });
      }
      if (!db.objectStoreNames.contains(STORE_EBOOKS)) {
        db.createObjectStore(STORE_EBOOKS, { keyPath: 'bookId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Format bytes to readable string (e.g. 24.5 MB, 1.2 KB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/* =========================================================================
   OFFLINE EBOOKS STORAGE ENGINE
   ========================================================================= */

/**
 * Save an ebook (chapters and metadata) to device IndexedDB
 */
export async function saveOfflineEbook(
  book: Audiobook,
  chapters: EbookChapter[],
  fullText?: string,
  readingPosition?: { chapterIndex: number; scrollPercentage: number }
): Promise<void> {
  try {
    const db = await openDB();
    const sizeBytes = new Blob([JSON.stringify(chapters) + (fullText || '')]).size;
    const now = Date.now();

    // Check existing to preserve progress if not explicitly passed
    const existing = await getOfflineEbook(book.id);

    const record: OfflineEbookData = {
      bookId: book.id,
      bookTitle: book.title,
      bookAuthor: book.author,
      coverImageUrl: book.coverImageUrl,
      chapters,
      fullText,
      storedAt: existing?.storedAt || now,
      lastReadChapterIndex: readingPosition?.chapterIndex ?? existing?.lastReadChapterIndex ?? 0,
      lastScrollPercentage: readingPosition?.scrollPercentage ?? existing?.lastScrollPercentage ?? 0,
      lastReadAt: now,
      sizeBytes,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_EBOOKS, 'readwrite');
      tx.objectStore(STORE_EBOOKS).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('libriaudio_ebooks_updated', { detail: { bookId: book.id } }));
    }
  } catch (err) {
    console.warn('Failed to save offline ebook to IndexedDB:', err);
  }
}

/**
 * Retrieve an offline stored ebook by bookId
 */
export async function getOfflineEbook(bookId: string): Promise<OfflineEbookData | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_EBOOKS, 'readonly');
      const store = tx.objectStore(STORE_EBOOKS);
      const req = store.get(bookId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Get all offline stored ebooks
 */
export async function getAllOfflineEbooks(): Promise<OfflineEbookData[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_EBOOKS, 'readonly');
      const store = tx.objectStore(STORE_EBOOKS);
      const req = store.getAll();
      req.onsuccess = () => {
        const list: OfflineEbookData[] = req.result || [];
        list.sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0));
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Check if a book's ebook is stored on device
 */
export async function isEbookStoredOffline(bookId: string): Promise<boolean> {
  const ebook = await getOfflineEbook(bookId);
  return !!ebook && ebook.chapters && ebook.chapters.length > 0;
}

/**
 * Update reading progress position on stored offline ebook
 */
export async function updateEbookReadingPosition(
  bookId: string,
  chapterIndex: number,
  scrollPercentage: number
): Promise<void> {
  try {
    const existing = await getOfflineEbook(bookId);
    if (!existing) return;

    const db = await openDB();
    const updated: OfflineEbookData = {
      ...existing,
      lastReadChapterIndex: chapterIndex,
      lastScrollPercentage: scrollPercentage,
      lastReadAt: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_EBOOKS, 'readwrite');
      tx.objectStore(STORE_EBOOKS).put(updated);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to update ebook reading position:', err);
  }
}

/**
 * Delete a stored offline ebook from device
 */
export async function deleteOfflineEbook(bookId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_EBOOKS, 'readwrite');
      tx.objectStore(STORE_EBOOKS).delete(bookId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('libriaudio_ebooks_updated', { detail: { bookId } }));
    }
  } catch (e) {
    console.warn('Failed to delete offline ebook:', e);
  }
}

/* =========================================================================
   AUDIOBOOK DOWNLOAD & OFFLINE PLAYBACK ENGINE
   ========================================================================= */

/**
 * Get all downloaded books metadata
 */
export async function getDownloadedBooks(): Promise<OfflineBookData[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BOOKS, 'readonly');
      const store = tx.objectStore(STORE_BOOKS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Failed to get downloaded books from IndexedDB', e);
    return [];
  }
}

/**
 * Get list of downloaded track IDs for a specific book
 */
export async function getDownloadedTrackIdsForBook(bookId: string): Promise<string[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_TRACKS, 'readonly');
      const store = tx.objectStore(STORE_TRACKS);
      const req = store.openCursor();
      const trackIds: string[] = [];

      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          if (cursor.value.bookId === bookId && cursor.value.trackId) {
            trackIds.push(cursor.value.trackId);
          }
          cursor.continue();
        } else {
          resolve(trackIds);
        }
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Check if a specific track is downloaded offline
 */
export async function isTrackDownloaded(bookId: string, trackId: string): Promise<boolean> {
  try {
    const db = await openDB();
    const trackKey = `${bookId}_${trackId}`;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_TRACKS, 'readonly');
      const store = tx.objectStore(STORE_TRACKS);
      const req = store.get(trackKey);
      req.onsuccess = () => resolve(!!req.result && !!req.result.blob);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Check download summary for a book
 */
export async function getBookDownloadSummary(book: Audiobook): Promise<{
  isFullyDownloaded: boolean;
  isPartiallyDownloaded: boolean;
  downloadedCount: number;
  totalTracks: number;
  downloadedTrackIds: string[];
  sizeBytes: number;
}> {
  try {
    const downloadedTrackIds = await getDownloadedTrackIdsForBook(book.id);
    const totalTracks = Math.max(1, book.tracks?.length || 1);
    const downloadedCount = downloadedTrackIds.length;

    // Retrieve recorded total size or compute from tracks
    const db = await openDB();
    const sizeBytes = await new Promise<number>((resolve) => {
      const tx = db.transaction(STORE_BOOKS, 'readonly');
      const req = tx.objectStore(STORE_BOOKS).get(book.id);
      req.onsuccess = () => resolve(req.result?.sizeBytes || downloadedCount * 3.5 * 1024 * 1024);
      req.onerror = () => resolve(downloadedCount * 3.5 * 1024 * 1024);
    });

    return {
      isFullyDownloaded: downloadedCount >= totalTracks && totalTracks > 0,
      isPartiallyDownloaded: downloadedCount > 0 && downloadedCount < totalTracks,
      downloadedCount,
      totalTracks,
      downloadedTrackIds,
      sizeBytes,
    };
  } catch {
    return {
      isFullyDownloaded: false,
      isPartiallyDownloaded: false,
      downloadedCount: 0,
      totalTracks: book.tracks?.length || 1,
      downloadedTrackIds: [],
      sizeBytes: 0,
    };
  }
}

/**
 * Check if a specific book is downloaded
 */
export async function isBookDownloaded(bookId: string): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_BOOKS, 'readonly');
      const store = tx.objectStore(STORE_BOOKS);
      const req = store.get(bookId);
      req.onsuccess = () =>
        resolve(!!req.result && (req.result.status === 'ready' || req.result.status === 'partial'));
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export const getAllOfflineBooks = getDownloadedBooks;
export const isBookOfflineReady = isBookDownloaded;

/**
 * Retrieve an offline blob URL for an audio track (with resilient fallback matching)
 */
export async function getOfflineAudioTrackUrl(
  bookId: string,
  trackId: string,
  trackNumber?: number
): Promise<string | null> {
  try {
    const db = await openDB();
    const trackKey = `${bookId}_${trackId}`;

    // 1. Direct primary key lookup
    const directBlob: Blob | null = await new Promise((resolve) => {
      const tx = db.transaction(STORE_TRACKS, 'readonly');
      const store = tx.objectStore(STORE_TRACKS);
      const req = store.get(trackKey);
      req.onsuccess = () => resolve(req.result?.blob || null);
      req.onerror = () => resolve(null);
    });

    if (directBlob && directBlob.size > 0) {
      return URL.createObjectURL(directBlob);
    }

    // 2. Cursor fallback search by trackNumber or trackId match under bookId
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_TRACKS, 'readonly');
      const store = tx.objectStore(STORE_TRACKS);
      const req = store.openCursor();

      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const val = cursor.value;
          if (
            val.bookId === bookId &&
            val.blob &&
            (val.trackId === trackId ||
              (trackNumber !== undefined && val.trackNumber === trackNumber) ||
              val.trackKey.includes(trackId))
          ) {
            resolve(URL.createObjectURL(val.blob));
            return;
          }
          cursor.continue();
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Helper to fetch audio blob with retry logic and CORS fallback
 */
async function fetchAudioBlob(audioUrl: string, maxRetries = 2): Promise<Blob> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response | null = null;

    // 1. Try CORS fetch
    try {
      response = await fetch(audioUrl, {
        mode: 'cors',
        signal: AbortSignal.timeout(30000),
      });
    } catch (err) {
      response = null;
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    // 2. If CORS fails, try no-cors (limited but may work for some endpoints)
    if (!response || !response.ok) {
      try {
        response = await fetch(audioUrl, {
          signal: AbortSignal.timeout(30000),
        });
      } catch (err) {
        response = null;
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    if (response && response.ok) {
      const blob = await response.blob();
      if (blob && blob.size >= 512) {
        return blob;
      }
      lastError = new Error('Downloaded audio stream was empty or truncated');
    }

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  throw lastError || new Error(`Failed to download audio track from ${audioUrl}`);
}

/**
 * Download specific tracks or full audiobook for offline listening
 */
export async function downloadAudiobook(
  book: Audiobook,
  optionsOrProgress?:
    | {
        trackIds?: string[];
        onProgress?: (percent: number, loadedBytes: number, currentTrackTitle?: string) => void;
      }
    | ((percent: number, loadedBytes?: number) => void)
): Promise<void> {
  const trackIds: string[] | undefined =
    optionsOrProgress && typeof optionsOrProgress === 'object' && 'trackIds' in optionsOrProgress
      ? optionsOrProgress.trackIds
      : undefined;

  const onProgress =
    typeof optionsOrProgress === 'function'
      ? optionsOrProgress
      : optionsOrProgress?.onProgress;

  // Resolve full tracklist if book currently only contains 1 preview track
  let activeBook = book;
  if (!activeBook.tracks || activeBook.tracks.length <= 1) {
    try {
      activeBook = await resolveFullTracklist(book);
    } catch (e) {
      console.warn('Could not resolve full tracklist before download, proceeding with available tracks:', e);
    }
  }

  const db = await openDB();
  const allTracks =
    activeBook.tracks && activeBook.tracks.length > 0
      ? activeBook.tracks
      : [
          {
            id: `${activeBook.id}_tr_1`,
            title: activeBook.title,
            audioUrl: 'https://archive.org/download/librivox_audio_collection/placeholder.mp3',
            durationSeconds: activeBook.totalTimeSecs || 1800,
            trackNumber: 1,
          },
        ];

  // If specific trackIds were selected, filter down; otherwise download all tracks
  const tracksToDownload =
    trackIds && trackIds.length > 0
      ? allTracks.filter((t) => trackIds.includes(t.id))
      : allTracks;

  let totalBytes = 0;

  // Mark initial record in IndexedDB
  const initialRecord: OfflineBookData = {
    bookId: activeBook.id,
    book: activeBook,
    sizeBytes: 0,
    downloadedAt: Date.now(),
    status: 'downloading',
    progress: 0,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_BOOKS, 'readwrite');
    tx.objectStore(STORE_BOOKS).put(initialRecord);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  const totalSelected = tracksToDownload.length;
  let successfulTracks = 0;

  for (let i = 0; i < totalSelected; i++) {
    const track = tracksToDownload[i];
    const trackKey = `${activeBook.id}_${track.id}`;
    let trackSuccess = false;

    // Per-track retry (up to 2 attempts)
    for (let attempt = 0; attempt < 2 && !trackSuccess; attempt++) {
      try {
        if (onProgress) {
          onProgress(Math.round((i / totalSelected) * 100), totalBytes, track.title);
        }

        const blob = await fetchAudioBlob(track.audioUrl);
        totalBytes += blob.size;

        // Store track binary in IndexedDB with quota error handling
        try {
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_TRACKS, 'readwrite');
            tx.objectStore(STORE_TRACKS).put({
              trackKey,
              bookId: activeBook.id,
              trackId: track.id,
              trackNumber: track.trackNumber || i + 1,
              title: track.title,
              durationSeconds: track.durationSeconds,
              blob,
              sizeBytes: blob.size,
              savedAt: Date.now(),
            });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          });
          trackSuccess = true;
          successfulTracks++;
        } catch (storageErr) {
          // Quota exceeded — stop downloading more tracks
          if (storageErr instanceof DOMException && storageErr.name === 'QuotaExceededError') {
            console.warn('Storage quota exceeded, stopping download');
            i = totalSelected; // break outer loop
            break;
          }
          throw storageErr;
        }
      } catch (err) {
        if (attempt === 0) {
          // Wait before retry
          await new Promise((r) => setTimeout(r, 1500));
        } else {
          console.warn(`Failed to download track ${track.title} (${track.id}) after retries:`, err);
        }
      }
    }

    if (trackSuccess) {
      const currentProgress = Math.round(((i + 1) / totalSelected) * 100);
      if (onProgress) {
        onProgress(currentProgress, totalBytes, track.title);
      }

      // Update progress record
      const progressRecord: OfflineBookData = {
        bookId: activeBook.id,
        book: activeBook,
        sizeBytes: totalBytes,
        downloadedAt: Date.now(),
        status:
          i === totalSelected - 1
            ? totalSelected >= allTracks.length
              ? 'ready'
              : 'partial'
            : 'downloading',
        progress: currentProgress,
      };

      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_BOOKS, 'readwrite');
        tx.objectStore(STORE_BOOKS).put(progressRecord);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }
  }

  // Finalize as ready, partial, or error
  const isFull = successfulTracks >= allTracks.length && allTracks.length > 0;
  const isPartial = successfulTracks > 0 && !isFull;
  const finalStatus = isFull ? 'ready' : isPartial ? 'partial' : 'error';

  const finalRecord: OfflineBookData = {
    bookId: activeBook.id,
    book: activeBook,
    sizeBytes: Math.max(totalBytes, successfulTracks * 2.5 * 1024 * 1024),
    downloadedAt: Date.now(),
    status: finalStatus,
    progress: 100,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_BOOKS, 'readwrite');
    tx.objectStore(STORE_BOOKS).put(finalRecord);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('libriaudio_offline_updated', { detail: { bookId: activeBook.id } })
    );
  }
}

/**
 * Trigger direct file download to user's browser device
 */
export async function downloadTrackFileToDevice(track: AudioTrack, bookTitle: string): Promise<void> {
  try {
    const blob = await fetchAudioBlob(track.audioUrl);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanBook = bookTitle.replace(/[^a-zA-Z0-9]/g, '_');
    const cleanTrack = (track.title || 'Track').replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `${cleanBook}_${cleanTrack}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (err) {
    console.error('Failed to download track file to device:', err);
    throw err;
  }
}

/**
 * Delete a single downloaded track from a book
 */
export async function deleteDownloadedTrack(bookId: string, trackId: string): Promise<void> {
  try {
    const db = await openDB();
    const trackKey = `${bookId}_${trackId}`;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readwrite');
      tx.objectStore(STORE_TRACKS).delete(trackKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const remainingTracks = await getDownloadedTrackIdsForBook(bookId);
    if (remainingTracks.length === 0) {
      await deleteDownloadedBook(bookId);
    } else {
      // Update book status to partial
      const book = await new Promise<OfflineBookData | null>((resolve) => {
        const tx = db.transaction(STORE_BOOKS, 'readonly');
        const req = tx.objectStore(STORE_BOOKS).get(bookId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (book) {
        book.status = 'partial' as any;
        const tx = db.transaction(STORE_BOOKS, 'readwrite');
        tx.objectStore(STORE_BOOKS).put(book);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('libriaudio_offline_updated', { detail: { bookId } })
      );
    }
  } catch (e) {
    console.warn('Error deleting track from offline storage:', e);
  }
}

/**
 * Delete a downloaded book and all its track files
 */
export async function deleteDownloadedBook(bookId: string): Promise<void> {
  try {
    const db = await openDB();

    // Remove from books store
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_BOOKS, 'readwrite');
      tx.objectStore(STORE_BOOKS).delete(bookId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Remove tracks matching bookId
    const tx = db.transaction(STORE_TRACKS, 'readwrite');
    const store = tx.objectStore(STORE_TRACKS);
    const req = store.openCursor();

    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        if (cursor.value.bookId === bookId) {
          cursor.delete();
        }
        cursor.continue();
      }
    };

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('libriaudio_offline_updated', { detail: { bookId } })
      );
    }
  } catch (e) {
    console.warn('Error deleting downloaded book:', e);
  }
}

/**
 * Calculate total offline cache size (audiobooks + offline ebooks)
 */
export async function getTotalOfflineStorageUsed(): Promise<{
  totalBytes: number;
  bookCount: number;
  ebookCount: number;
  audiobookBytes: number;
  ebookBytes: number;
}> {
  const books = await getDownloadedBooks();
  const readyBooks = books.filter(
    (b) => b.status === 'ready' || (b.status as string) === 'partial'
  );
  const audiobookBytes = readyBooks.reduce((acc, curr) => acc + (curr.sizeBytes || 0), 0);

  const ebooks = await getAllOfflineEbooks();
  const ebookBytes = ebooks.reduce((acc, curr) => acc + (curr.sizeBytes || 0), 0);

  return {
    totalBytes: audiobookBytes + ebookBytes,
    bookCount: readyBooks.length,
    ebookCount: ebooks.length,
    audiobookBytes,
    ebookBytes,
  };
}
