import React from 'react';
import { Check, Download, Cloud, Radio, Wifi, WifiOff, HardDrive } from 'lucide-react';
import { Audiobook, OfflineBookData } from '../types';

export type SyncStatusType = 'cached' | 'partial' | 'streaming' | 'cloud';

export interface BookSyncInfo {
  status: SyncStatusType;
  label: string;
  shortLabel: string;
  description: string;
  downloadedTracks: number;
  totalTracks: number;
  progressPercent: number;
  isActivelyStreaming: boolean;
}

/**
 * Determine the exact sync and cache state of an audiobook
 */
export function getBookSyncStatus(
  book: Audiobook,
  offlineBooks: OfflineBookData[],
  currentBook: Audiobook | null,
  isPlaying: boolean,
  summary?: {
    isFullyDownloaded?: boolean;
    isPartiallyDownloaded?: boolean;
    downloadedCount?: number;
    totalTracks?: number;
  }
): BookSyncInfo {
  const offlineEntry = offlineBooks.find((o) => o.bookId === book.id);
  const totalTracks = summary?.totalTracks || book.tracks?.length || 1;
  const downloadedTracks = summary?.downloadedCount ?? (offlineEntry?.status === 'ready' ? totalTracks : 0);
  const isCurrentPlaying = currentBook?.id === book.id && isPlaying;
  const isCurrentActive = currentBook?.id === book.id;

  // 1. Fully Cached
  const isFullyCached =
    offlineEntry?.status === 'ready' ||
    summary?.isFullyDownloaded ||
    (downloadedTracks >= totalTracks && totalTracks > 0);

  if (isFullyCached) {
    return {
      status: 'cached',
      label: 'Fully Cached',
      shortLabel: 'Cached',
      description: isCurrentPlaying
        ? 'Playing offline from local cache (Zero network usage)'
        : '100% saved offline • Ready for offline listening',
      downloadedTracks: totalTracks,
      totalTracks,
      progressPercent: 100,
      isActivelyStreaming: false,
    };
  }

  // 2. Currently Streaming from network
  if (isCurrentPlaying || (isCurrentActive && !isFullyCached)) {
    return {
      status: 'streaming',
      label: isCurrentPlaying ? 'Currently Streaming' : 'Stream Ready',
      shortLabel: 'Streaming',
      description: isCurrentPlaying
        ? 'Live streaming audio over internet connection'
        : 'Active stream session ready',
      downloadedTracks,
      totalTracks,
      progressPercent: Math.round((downloadedTracks / Math.max(1, totalTracks)) * 100),
      isActivelyStreaming: isCurrentPlaying,
    };
  }

  // 3. Partially Downloaded / In-Progress
  const isPartial =
    offlineEntry?.status === 'downloading' ||
    summary?.isPartiallyDownloaded ||
    (downloadedTracks > 0 && downloadedTracks < totalTracks);

  if (isPartial) {
    const pct = offlineEntry?.progress || Math.round((downloadedTracks / Math.max(1, totalTracks)) * 100);
    return {
      status: 'partial',
      label: `Partially Cached (${downloadedTracks}/${totalTracks})`,
      shortLabel: `${downloadedTracks}/${totalTracks}`,
      description: `${downloadedTracks} of ${totalTracks} tracks stored locally (${pct}%)`,
      downloadedTracks,
      totalTracks,
      progressPercent: pct,
      isActivelyStreaming: false,
    };
  }

  // 4. Cloud Only (Stream on demand)
  return {
    status: 'cloud',
    label: 'Cloud Stream',
    shortLabel: 'Cloud',
    description: 'Stored in LibriVox catalog • Streams online on demand',
    downloadedTracks: 0,
    totalTracks,
    progressPercent: 0,
    isActivelyStreaming: false,
  };
}

interface CoverSyncBadgeProps {
  syncInfo: BookSyncInfo;
  size?: 'sm' | 'md';
}

/**
 * Visual badge rendered directly over the Book Cover image in Library
 */
export const CoverSyncBadge: React.FC<CoverSyncBadgeProps> = ({ syncInfo, size = 'sm' }) => {
  const { status, shortLabel, isActivelyStreaming, progressPercent } = syncInfo;

  if (status === 'cached') {
    return (
      <div
        className="absolute top-1 left-1 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 backdrop-blur-md shadow-md shadow-black/60"
        title="Fully Cached • Offline Ready"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[9px] font-mono font-bold tracking-tight uppercase">
          {size === 'md' ? 'Cached' : '✓'}
        </span>
      </div>
    );
  }

  if (status === 'streaming') {
    return (
      <div
        className="absolute top-1 left-1 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-950/90 border border-sky-400/60 text-sky-300 backdrop-blur-md shadow-md shadow-sky-500/20"
        title="Currently Streaming over Internet"
      >
        {isActivelyStreaming ? (
          <div className="flex items-end gap-0.5 h-2">
            <span className="w-0.5 h-1.5 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-0.5 h-2 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-0.5 h-1 bg-sky-400 rounded-full animate-bounce" />
          </div>
        ) : (
          <Radio className="w-2.5 h-2.5 text-sky-400 animate-pulse" />
        )}
        <span className="text-[9px] font-mono font-bold tracking-tight uppercase">
          {size === 'md' ? 'Stream' : '~ Live'}
        </span>
      </div>
    );
  }

  if (status === 'partial') {
    return (
      <div
        className="absolute top-1 left-1 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-950/90 border border-amber-500/50 text-amber-300 backdrop-blur-md shadow-md shadow-black/60"
        title={`Partially Downloaded: ${shortLabel} tracks cached`}
      >
        <Download className="w-2.5 h-2.5 text-amber-400" />
        <span className="text-[9px] font-mono font-bold tracking-tight">
          {shortLabel}
        </span>
      </div>
    );
  }

  // Cloud
  return (
    <div
      className="absolute top-1 left-1 z-10 flex items-center gap-0.5 px-1 py-0.5 rounded-md bg-black/80 border border-white/15 text-white/60 backdrop-blur-sm shadow-sm"
      title="Cloud Audio • Streams on demand"
    >
      <Cloud className="w-2.5 h-2.5 text-white/50" />
      {size === 'md' && <span className="text-[8px] font-mono tracking-tight text-white/50">Online</span>}
    </div>
  );
};

interface InlineSyncBadgeProps {
  syncInfo: BookSyncInfo;
}

/**
 * Visual pill badge displayed alongside book details/meta row
 */
export const InlineSyncBadge: React.FC<InlineSyncBadgeProps> = ({ syncInfo }) => {
  const { status, label, description } = syncInfo;

  if (status === 'cached') {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-mono font-medium shrink-0"
        title={description}
      >
        <Check className="w-2.5 h-2.5 stroke-[2.5]" />
        <span>Cached</span>
      </span>
    );
  }

  if (status === 'streaming') {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-500/10 border border-sky-400/30 text-sky-300 text-[10px] font-mono font-medium shrink-0 animate-pulse"
        title={description}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
        <span>Streaming</span>
      </span>
    );
  }

  if (status === 'partial') {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[10px] font-mono font-medium shrink-0"
        title={description}
      >
        <Download className="w-2.5 h-2.5" />
        <span>Partial ({syncInfo.downloadedTracks}/{syncInfo.totalTracks})</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/[0.03] border border-white/10 text-white/40 text-[10px] font-mono font-medium shrink-0"
      title={description}
    >
      <Cloud className="w-2.5 h-2.5" />
      <span>Cloud</span>
    </span>
  );
};

interface SyncLegendBarProps {
  stats: {
    cached: number;
    partial: number;
    streaming: number;
    cloud: number;
  };
}

/**
 * Quick legend status bar in Library to show overall storage & streaming summary
 */
export const SyncLegendBar: React.FC<SyncLegendBarProps> = ({ stats }) => {
  return (
    <div
      id="library-sync-legend-bar"
      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] text-[11px] text-white/60 mb-4"
    >
      <div className="flex items-center gap-1.5 text-white/50 text-[10px] font-mono uppercase tracking-wider">
        <HardDrive className="w-3 h-3 text-[#C5A059]" />
        <span>Sync Status:</span>
      </div>

      <div className="flex items-center gap-3 flex-wrap text-[11px]">
        <div className="flex items-center gap-1.5 text-emerald-400" title="Full books stored locally in device storage">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          <span className="font-medium text-white/80">Cached</span>
          <span className="font-mono text-[10px] px-1 rounded bg-emerald-500/15 border border-emerald-500/20 text-emerald-300">
            {stats.cached}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-amber-300" title="Partially downloaded audiobooks">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          <span className="font-medium text-white/80">Partial</span>
          <span className="font-mono text-[10px] px-1 rounded bg-amber-500/15 border border-amber-500/20 text-amber-300">
            {stats.partial}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-sky-300" title="Currently streaming over network">
          <span className="w-2 h-2 rounded-full bg-sky-400 inline-block animate-pulse" />
          <span className="font-medium text-white/80">Streaming</span>
          <span className="font-mono text-[10px] px-1 rounded bg-sky-500/15 border border-sky-500/20 text-sky-300">
            {stats.streaming}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-white/40" title="Stored in cloud catalog">
          <span className="w-2 h-2 rounded-full bg-white/30 inline-block" />
          <span className="font-medium text-white/60">Cloud</span>
          <span className="font-mono text-[10px] px-1 rounded bg-white/10 text-white/50">
            {stats.cloud}
          </span>
        </div>
      </div>
    </div>
  );
};
