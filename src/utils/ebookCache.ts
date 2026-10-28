import { EbookChapter } from '../types';

/* =========================================================================
   EBOOK CONTENT CACHE — IndexedDB-backed, instant offline availability
   ========================================================================= */

const DB_NAME = 'LibriAudio_EbookCache';
const DB_VERSION = 1;
const STORE_NAME = 'ebooks';

interface CachedEbook {
  bookId: string;
  fullText: string;
  chapters: EbookChapter[];
  format: 'html' | 'epub' | 'txt';
  sourceUrl: string;
  gutenbergId?: number;
  cachedAt: number;
  sizeBytes: number;
  lastReadChapterIndex: number;
  lastScrollPercentage: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'bookId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Cache fetched ebook content for instant offline access.
 */
export async function cacheEbook(
  bookId: string,
  fullText: string,
  chapters: EbookChapter[],
  format: 'html' | 'epub' | 'txt',
  sourceUrl: string,
  gutenbergId?: number,
): Promise<void> {
  try {
    const db = await openDB();
    const record: CachedEbook = {
      bookId,
      fullText,
      chapters,
      format,
      sourceUrl,
      gutenbergId,
      cachedAt: Date.now(),
      sizeBytes: new Blob([fullText]).size,
      lastReadChapterIndex: 0,
      lastScrollPercentage: 0,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    db.close();
  } catch (err) {
    console.warn('[ebookCache] Failed to cache ebook:', err);
  }
}

/**
 * Retrieve cached ebook content. Returns null if not cached.
 */
export async function getCachedEbook(
  bookId: string,
): Promise<{ fullText: string; chapters: EbookChapter[]; format: string; sourceUrl: string } | null> {
  try {
    const db = await openDB();
    const result = await new Promise<CachedEbook | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(bookId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    db.close();

    if (result && result.chapters && result.chapters.length > 0) {
      return {
        fullText: result.fullText,
        chapters: result.chapters,
        format: result.format,
        sourceUrl: result.sourceUrl,
      };
    }
  } catch (err) {
    console.warn('[ebookCache] Failed to read cache:', err);
  }
  return null;
}

/**
 * Update reading position within a cached ebook.
 */
export async function updateCachedPosition(
  bookId: string,
  chapterIndex: number,
  scrollPercentage: number,
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(bookId);

    req.onsuccess = () => {
      const record = req.result as CachedEbook | undefined;
      if (record) {
        record.lastReadChapterIndex = chapterIndex;
        record.lastScrollPercentage = scrollPercentage;
        store.put(record);
      }
    };

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    db.close();
  } catch (err) {
    // Silent fail for position updates
  }
}

/**
 * Check if an ebook is cached.
 */
export async function isEbookCached(bookId: string): Promise<boolean> {
  try {
    const db = await openDB();
    const result = await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).count(bookId);
      req.onsuccess = () => resolve(req.result > 0);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return false;
  }
}

/**
 * Delete a cached ebook.
 */
export async function deleteCachedEbook(bookId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(bookId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('[ebookCache] Failed to delete cached ebook:', err);
  }
}
