import { registerPlugin } from '@capacitor/core';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface DownloadProgress {
  bookId: string;
  chapterId: string;
  status: DownloadStatus;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  error?: string;
}

export interface ChapterDownloadRequest {
  bookId: string;
  chapterId: string;
  remoteUrl: string;
  bookTitle?: string;
  chapterTitle?: string;
}

export interface DownloadedChapterInfo {
  bookId: string;
  chapterId: string;
  remoteUrl: string;
  bookTitle: string;
  chapterTitle: string;
  status: DownloadStatus;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  fileSizeBytes: number;
  isOnDisk: boolean;
  filePath?: string;
}

export interface BookDownloadGroup {
  bookId: string;
  bookTitle: string;
  chapters: DownloadedChapterInfo[];
  totalBytes: number;
  completedCount: number;
  activeCount: number;
}

interface ChapterManifestEntry {
  bookId: string;
  chapterId: string;
  remoteUrl: string;
  bookTitle?: string;
  chapterTitle?: string;
  status: DownloadStatus;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  fileSizeBytes?: number;
  updatedAt: number;
}

type ProgressListener = (progress: DownloadProgress) => void;
type StateListener = (groups: BookDownloadGroup[]) => void;

const MANIFEST_KEY = 'libreaudio_chapter_manifest';

/* ------------------------------------------------------------------ */
/*  Native plugin bridge                                               */
/* ------------------------------------------------------------------ */

interface NativeChapterFile {
  bookId: string;
  chapterId: string;
  filePath: string;
  fileSizeBytes: number;
  exists: boolean;
}

interface AudioDownloadPlugin {
  checkStoragePermission(): Promise<{ granted: boolean }>;
  requestStoragePermission(): Promise<{ granted: boolean }>;
  getDownloadsDirectory(): Promise<{ path: string }>;
  listDownloadedChapters(): Promise<{ chapters: NativeChapterFile[] }>;
  downloadChapter(options: ChapterDownloadRequest): Promise<void>;
  pauseDownload(options: { bookId: string; chapterId: string }): Promise<void>;
  resumeDownload(options: {
    bookId: string;
    chapterId: string;
    remoteUrl: string;
    bookTitle?: string;
    chapterTitle?: string;
  }): Promise<void>;
  cancelDownload(options: { bookId: string; chapterId: string }): Promise<void>;
  deleteDownloadedChapter(options: { bookId: string; chapterId: string }): Promise<void>;
  deleteBookDownloads(options: { bookId: string }): Promise<void>;
  getPlayableUri(options: {
    bookId: string;
    chapterId: string;
    remoteUrl: string;
  }): Promise<{ uri: string }>;
  fileExists(options: { bookId: string; chapterId: string }): Promise<{ exists: boolean }>;
  addListener(
    eventName: 'downloadProgress',
    handler: (event: DownloadProgress) => void,
  ): Promise<{ remove: () => void }>;
}

const AudioDownload = registerPlugin<AudioDownloadPlugin>('Download');

const isNative = (): boolean =>
  typeof (window as any).Capacitor?.isNativePlatform === 'function' &&
  !!(window as any).Capacitor?.isNativePlatform?.();

/* ------------------------------------------------------------------ */
/*  Manifest persistence (remote URLs + metadata for resume)           */
/* ------------------------------------------------------------------ */

function loadManifest(): Record<string, ChapterManifestEntry> {
  try {
    const raw = localStorage.getItem(MANIFEST_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveManifest(manifest: Record<string, ChapterManifestEntry>): void {
  try {
    localStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest));
  } catch {
    // quota — best effort
  }
}

function manifestKey(bookId: string, chapterId: string): string {
  return `${bookId}/${chapterId}`;
}

/* ------------------------------------------------------------------ */
/*  AudioDownloadService                                               */
/* ------------------------------------------------------------------ */

/**
 * Resilient audio download manager.
 *
 * Stores files at: `{documents}/audiobooks/{bookId}/{chapterId}.mp3`
 * Native layer attaches Archive.org / LibriVox headers and follows redirects.
 */
class AudioDownloadServiceImpl {
  private initialized = false;
  private downloadsDir: string | null = null;
  private listeners = new Set<ProgressListener>();
  private stateListeners = new Set<StateListener>();
  private nativeListener: { remove: () => void } | null = null;
  private chapterStates = new Map<string, DownloadedChapterInfo>();

  private notifyStateListeners(): void {
    this.listDownloads()
      .then((groups) => this.stateListeners.forEach((cb) => cb(groups)))
      .catch(() => {});
  }

  private upsertFromProgress(progress: DownloadProgress): void {
    const key = manifestKey(progress.bookId, progress.chapterId);
    const manifest = loadManifest();
    const prev = manifest[key];
    const entry: ChapterManifestEntry = {
      bookId: progress.bookId,
      chapterId: progress.chapterId,
      remoteUrl: prev?.remoteUrl || '',
      bookTitle: prev?.bookTitle,
      chapterTitle: prev?.chapterTitle,
      status: progress.status,
      percent: progress.percent,
      downloadedBytes: progress.downloadedBytes,
      totalBytes: progress.totalBytes,
      fileSizeBytes:
        progress.status === 'completed' ? progress.totalBytes : prev?.fileSizeBytes,
      updatedAt: Date.now(),
    };
    manifest[key] = entry;
    saveManifest(manifest);

    const info: DownloadedChapterInfo = {
      bookId: progress.bookId,
      chapterId: progress.chapterId,
      remoteUrl: entry.remoteUrl,
      bookTitle: entry.bookTitle || progress.bookId,
      chapterTitle: entry.chapterTitle || progress.chapterId,
      status: progress.status,
      percent: progress.percent,
      downloadedBytes: progress.downloadedBytes,
      totalBytes: progress.totalBytes,
      fileSizeBytes: entry.fileSizeBytes || progress.downloadedBytes,
      isOnDisk: progress.status === 'completed',
    };
    this.chapterStates.set(key, info);
    this.notifyStateListeners();
  }

  /** Request storage permission and resolve the downloads directory. */
  async initialize(): Promise<string> {
    if (!isNative()) {
      this.downloadsDir = 'audiobooks';
      this.initialized = true;
      return this.downloadsDir;
    }

    const perm = await AudioDownload.checkStoragePermission();
    if (!perm.granted) {
      const req = await AudioDownload.requestStoragePermission();
      if (!req.granted) {
        throw new Error('Storage permission denied');
      }
    }

    const { path } = await AudioDownload.getDownloadsDirectory();
    this.downloadsDir = path;
    this.initialized = true;

    if (!this.nativeListener) {
      this.nativeListener = await AudioDownload.addListener('downloadProgress', (event) => {
        this.upsertFromProgress(event);
        this.listeners.forEach((cb) => cb(event));
      });
    }

    await this.refreshFromDisk();
    return path;
  }

  async getDownloadsDirectory(): Promise<string> {
    if (this.downloadsDir) return this.downloadsDir;
    return this.initialize();
  }

  /** Subscribe to per-chapter progress events. */
  onProgress(callback: ProgressListener): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /** Subscribe to grouped download list changes. */
  onStateChange(callback: StateListener): () => void {
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

  getChapterState(bookId: string, chapterId: string): DownloadedChapterInfo | null {
    return this.chapterStates.get(manifestKey(bookId, chapterId)) || null;
  }

  /** Scan on-disk files and merge with manifest + in-memory active jobs. */
  async refreshFromDisk(): Promise<BookDownloadGroup[]> {
    const groups = await this.listDownloads();
    this.notifyStateListeners();
    return groups;
  }

  async listDownloads(): Promise<BookDownloadGroup[]> {
    const manifest = loadManifest();
    const merged = new Map<string, DownloadedChapterInfo>();

    if (isNative()) {
      try {
        const { chapters } = await AudioDownload.listDownloadedChapters();
        for (const file of chapters || []) {
          const key = manifestKey(file.bookId, file.chapterId);
          const meta = manifest[key];
          const active = this.chapterStates.get(key);
          merged.set(key, {
            bookId: file.bookId,
            chapterId: file.chapterId,
            remoteUrl: meta?.remoteUrl || active?.remoteUrl || '',
            bookTitle: meta?.bookTitle || active?.bookTitle || file.bookId,
            chapterTitle: meta?.chapterTitle || active?.chapterTitle || file.chapterId,
            status: active?.status || (file.exists ? 'completed' : 'failed'),
            percent: active?.percent ?? (file.exists ? 100 : 0),
            downloadedBytes: active?.downloadedBytes ?? file.fileSizeBytes,
            totalBytes: active?.totalBytes ?? file.fileSizeBytes,
            fileSizeBytes: file.fileSizeBytes,
            isOnDisk: file.exists,
            filePath: file.filePath,
          });
        }
      } catch {
        // fall through to manifest-only
      }
    }

    for (const [key, meta] of Object.entries(manifest)) {
      if (merged.has(key)) continue;
      const active = this.chapterStates.get(key);
      if (active) {
        merged.set(key, active);
        continue;
      }
      if (meta.status === 'downloading' || meta.status === 'paused' || meta.status === 'queued') {
        merged.set(key, {
          bookId: meta.bookId,
          chapterId: meta.chapterId,
          remoteUrl: meta.remoteUrl,
          bookTitle: meta.bookTitle || meta.bookId,
          chapterTitle: meta.chapterTitle || meta.chapterId,
          status: meta.status,
          percent: meta.percent,
          downloadedBytes: meta.downloadedBytes,
          totalBytes: meta.totalBytes,
          fileSizeBytes: meta.fileSizeBytes || 0,
          isOnDisk: false,
        });
      }
    }

    for (const [key, active] of this.chapterStates) {
      if (!merged.has(key)) merged.set(key, active);
    }

    const byBook = new Map<string, BookDownloadGroup>();
    for (const chapter of merged.values()) {
      const existing = byBook.get(chapter.bookId);
      if (existing) {
        existing.chapters.push(chapter);
        existing.totalBytes += chapter.fileSizeBytes;
        if (chapter.status === 'completed') existing.completedCount += 1;
        if (chapter.status === 'downloading' || chapter.status === 'paused' || chapter.status === 'queued') {
          existing.activeCount += 1;
        }
      } else {
        byBook.set(chapter.bookId, {
          bookId: chapter.bookId,
          bookTitle: chapter.bookTitle,
          chapters: [chapter],
          totalBytes: chapter.fileSizeBytes,
          completedCount: chapter.status === 'completed' ? 1 : 0,
          activeCount:
            chapter.status === 'downloading' || chapter.status === 'paused' || chapter.status === 'queued'
              ? 1
              : 0,
        });
      }
    }

    return Array.from(byBook.values()).sort((a, b) => a.bookTitle.localeCompare(b.bookTitle));
  }

  async getTotalStorageUsed(): Promise<{ totalBytes: number; chapterCount: number; bookCount: number }> {
    const groups = await this.listDownloads();
    const totalBytes = groups.reduce((sum, g) => sum + g.totalBytes, 0);
    const chapterCount = groups.reduce((sum, g) => sum + g.chapters.filter((c) => c.isOnDisk).length, 0);
    return { totalBytes, chapterCount, bookCount: groups.length };
  }

  async downloadChapter(request: ChapterDownloadRequest): Promise<void> {
    await this.initialize();
    const key = manifestKey(request.bookId, request.chapterId);
    const manifest = loadManifest();
    manifest[key] = {
      bookId: request.bookId,
      chapterId: request.chapterId,
      remoteUrl: request.remoteUrl,
      bookTitle: request.bookTitle,
      chapterTitle: request.chapterTitle,
      status: 'queued',
      percent: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      updatedAt: Date.now(),
    };
    saveManifest(manifest);

    if (!isNative()) {
      throw new Error('Chapter downloads require the native Android app');
    }
    await AudioDownload.downloadChapter(request);
  }

  async downloadChapters(
    bookId: string,
    chapters: Array<{
      chapterId: string;
      remoteUrl: string;
      chapterTitle?: string;
    }>,
    bookTitle?: string,
  ): Promise<void> {
    for (const ch of chapters) {
      await this.downloadChapter({
        bookId,
        chapterId: ch.chapterId,
        remoteUrl: ch.remoteUrl,
        bookTitle,
        chapterTitle: ch.chapterTitle,
      });
    }
  }

  async pauseDownload(bookId: string, chapterId: string): Promise<void> {
    if (!isNative()) return;
    await AudioDownload.pauseDownload({ bookId, chapterId });
    const key = manifestKey(bookId, chapterId);
    const manifest = loadManifest();
    if (manifest[key]) {
      manifest[key].status = 'paused';
      saveManifest(manifest);
    }
    this.notifyStateListeners();
  }

  async resumeDownload(bookId: string, chapterId: string): Promise<void> {
    if (!isNative()) return;
    const manifest = loadManifest();
    const entry = manifest[manifestKey(bookId, chapterId)];
    if (!entry?.remoteUrl) {
      throw new Error('Cannot resume: remote URL not found in manifest');
    }
    await AudioDownload.resumeDownload({
      bookId,
      chapterId,
      remoteUrl: entry.remoteUrl,
      bookTitle: entry.bookTitle,
      chapterTitle: entry.chapterTitle,
    });
  }

  async cancelDownload(bookId: string, chapterId: string): Promise<void> {
    if (!isNative()) return;
    await AudioDownload.cancelDownload({ bookId, chapterId });
    const key = manifestKey(bookId, chapterId);
    const manifest = loadManifest();
    if (manifest[key]) {
      manifest[key].status = 'cancelled';
      saveManifest(manifest);
    }
    this.chapterStates.delete(key);
    this.notifyStateListeners();
  }

  async deleteDownloadedChapter(bookId: string, chapterId: string): Promise<void> {
    if (isNative()) {
      await AudioDownload.deleteDownloadedChapter({ bookId, chapterId });
    }
    const key = manifestKey(bookId, chapterId);
    const manifest = loadManifest();
    delete manifest[key];
    saveManifest(manifest);
    this.chapterStates.delete(key);
    this.notifyStateListeners();
  }

  async deleteBookDownloads(bookId: string): Promise<void> {
    if (isNative()) {
      await AudioDownload.deleteBookDownloads({ bookId });
    }
    const manifest = loadManifest();
    for (const key of Object.keys(manifest)) {
      if (manifest[key].bookId === bookId) delete manifest[key];
    }
    saveManifest(manifest);
    for (const key of [...this.chapterStates.keys()]) {
      if (key.startsWith(`${bookId}/`)) this.chapterStates.delete(key);
    }
    this.notifyStateListeners();
  }

  async isDownloaded(bookId: string, chapterId: string): Promise<boolean> {
    if (!isNative()) return false;
    const { exists } = await AudioDownload.fileExists({ bookId, chapterId });
    return exists;
  }

  /**
   * Returns a `file://` URI when the chapter is stored locally,
   * otherwise returns the remote HTTPS URL unchanged.
   */
  async getPlayableUri(
    bookId: string,
    chapterId: string,
    remoteUrl: string,
  ): Promise<string> {
    if (!isNative()) return remoteUrl;
    try {
      const { uri } = await AudioDownload.getPlayableUri({ bookId, chapterId, remoteUrl });
      return uri || remoteUrl;
    } catch {
      return remoteUrl;
    }
  }
}

export const audioDownloadService = new AudioDownloadServiceImpl();
