import { registerPlugin } from '@capacitor/core';
import { Audiobook } from '../types';
import { resolveFullTracklist } from './librivoxRecommendations';
import {
  saveNativeTrack,
  finalizeNativeBook,
  getBookDownloadSummary,
  NativeTrackPayload,
} from './offlineStorage';

const isNative = (): boolean =>
  typeof (window as any).Capacitor?.isNativePlatform === 'function' &&
  !!(window as any).Capacitor?.isNativePlatform?.();

interface TrackReadyEvent {
  bookId: string;
  filePath: string;
  trackKey: string;
  trackId?: string;
  trackNumber?: number;
  title?: string;
  durationSeconds?: number;
  index: number;
  total: number;
}

export interface ProgressEvent {
  bookId: string;
  bookTitle: string;
  percent: number;
  bytesLoaded: number;
  trackTitle: string;
  completedTracks: number;
  totalTracks: number;
}

interface DownloadPluginDef {
  checkNotificationPermission(): Promise<{ granted: boolean }>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
  startDownload(options: {
    bookId: string;
    bookTitle: string;
    tracks: NativeTrackPayload[];
  }): Promise<void>;
  cancel(): Promise<void>;
  isDownloading(): Promise<{ downloading: boolean }>;
  readTrack(options: {
    filePath: string;
    deleteAfter?: boolean;
  }): Promise<{ base64: string; size: number }>;
  deleteTrack(options: { filePath: string }): Promise<void>;
  addListener(
    eventName: string,
    handler: (event: any) => void,
  ): Promise<{ remove: () => void }>;
}

const Download = registerPlugin<DownloadPluginDef>('Download');

function base64ToBlob(b64: string, mime = 'audio/mpeg'): Blob {
  try {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  } catch {
    return new Blob();
  }
}

/**
 * Ask for notification permission (Android 13+). Safe no-op elsewhere.
 */
export async function requestDownloadNotificationPermission(): Promise<boolean> {
  if (!isNative()) return true;
  try {
    const cur = await Download.checkNotificationPermission();
    if (cur.granted) return true;
    const res = await Download.requestNotificationPermission();
    return res.granted;
  } catch {
    return false;
  }
}

/**
 * Download a book via the native Android foreground service. Real streaming
 * progress is reported through `options.onProgress` and posted by the native
 * service as a notification, so the download continues after leaving the page.
 * Resolves when the download finishes (ready/partial) and rejects on failure.
 */
export async function downloadBookNative(
  book: Audiobook,
  options?: { trackIds?: string[]; onProgress?: (progress: ProgressEvent) => void },
): Promise<{ ready: boolean; partial: boolean }> {
  try {
    await requestDownloadNotificationPermission();
  } catch {}

  if (!isNative()) {
    throw new Error('Native download not available in this environment');
  }

  let active = book;
  try {
    if (!active.tracks || active.tracks.length <= 1) {
      active = await resolveFullTracklist(book);
    }
  } catch {
    // keep whatever tracks we have
  }

  const allTracks = active.tracks && active.tracks.length > 0 ? active.tracks : [];
  const selected =
    options?.trackIds && options.trackIds.length > 0
      ? allTracks.filter((t) => options.trackIds!.includes(t.id))
      : allTracks;

  let lastPercent = 0;
  const listeners: { remove: () => void }[] = [];
  const cb = options?.onProgress;

  return new Promise<{ ready: boolean; partial: boolean }>(async (resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      listeners.forEach((l) => {
        try {
          l.remove();
        } catch {}
      });
      fn();
    };

    const onProgress = await Download.addListener('downloadProgress', (e: ProgressEvent) => {
      lastPercent = e.percent || 0;
      cb?.(e);
    });
    listeners.push(onProgress);

    const onTrackReady = await Download.addListener('trackReady', async (e: TrackReadyEvent) => {
      try {
        const payload: NativeTrackPayload = {
          audioUrl: '',
          trackId: e.trackId || e.trackKey,
          trackKey: e.trackKey,
          trackNumber: e.trackNumber || 0,
          title: e.title || '',
          durationSeconds: e.durationSeconds || 0,
        };
        const { base64 } = await Download.readTrack({
          filePath: e.filePath,
          deleteAfter: true,
        });
        if (!base64) return;
        const blob = base64ToBlob(base64);
        if (blob.size > 0) {
          await saveNativeTrack(active, payload, blob, lastPercent);
        }
      } catch (err) {
        console.warn('Failed to persist native track:', err);
      }
    });
    listeners.push(onTrackReady);

    const onComplete = await Download.addListener('downloadComplete', async () => {
      try {
        const summary = await getBookDownloadSummary(active);
        const status = summary.isFullyDownloaded
          ? 'ready'
          : summary.isPartiallyDownloaded
          ? 'partial'
          : 'error';
        await finalizeNativeBook(active, status, summary.sizeBytes);
        settle(() =>
          resolve({ ready: summary.isFullyDownloaded, partial: summary.isPartiallyDownloaded }),
        );
      } catch (err) {
        settle(() => reject(err as Error));
      }
    });
    listeners.push(onComplete);

    const onError = await Download.addListener('downloadError', (e: { message: string }) => {
      settle(() => reject(new Error(e.message || 'Download failed')));
    });
    listeners.push(onError);

    const onCancelled = await Download.addListener('downloadCancelled', () => {
      settle(() => reject(new Error('Download cancelled')));
    });
    listeners.push(onCancelled);

    const payloads: NativeTrackPayload[] = selected.map((t) => ({
      audioUrl: t.audioUrl,
      trackId: t.id,
      trackKey: `${active.id}_${t.id}`,
      trackNumber: t.trackNumber || 0,
      title: t.title,
      durationSeconds: t.durationSeconds,
    }));

    Download.startDownload({
      bookId: active.id,
      bookTitle: active.title,
      tracks: payloads,
    }).catch((err) => settle(() => reject(err as Error)));
  });
}

export { isNative as isNativePlatform };
export const nativeDownloadEnabled = (): boolean => isNative();

/**
 * Cancel the active native download.
 */
export async function cancelNativeDownload(): Promise<void> {
  try {
    await Download.cancel();
  } catch {}
}

/**
 * Check whether a native download is currently running.
 */
export async function isNativeDownloading(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const res = await Download.isDownloading();
    return !!res.downloading;
  } catch {
    return false;
  }
}
