import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PlayerState } from '../types';
import { getOfflineAudioTrackUrl } from '../utils/offlineStorage';
import MediaNotification, { MediaNotificationAction } from '../utils/mediaNotification';

interface AudioEngineProps {
  playerState: PlayerState;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onEnded: () => void;
  onBuffering: (isBuffering: boolean) => void;
  onError: (err: string) => void;
  onPlay: () => void;
  onPause: () => void;
  onSkipNext: () => void;
  onSkipPrevious: () => void;
}

function isValidAudioUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.length < 5) return false;
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('blob:');
}

/**
 * Attempt to fetch audio as a blob and return an object URL.
 * Used as fallback when direct <audio> playback fails (CORS, network issues).
 */
async function fetchAudioAsBlobUrl(audioUrl: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(audioUrl, { mode: 'cors', signal });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob || blob.size < 512) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export const AudioEngine: React.FC<AudioEngineProps> = ({
  playerState,
  onTimeUpdate,
  onEnded,
  onBuffering,
  onError,
  onPlay,
  onPause,
  onSkipNext,
  onSkipPrevious,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const biquadFilterRef = useRef<BiquadFilterNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const targetSeekTimeRef = useRef<number>(playerState.currentTime || 0);
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const retryCountRef = useRef<number>(0);
  const trackRef = useRef(playerState.currentTrack);
  const bookRef = useRef(playerState.currentBook);

  // Keep refs fresh for closure-safe callbacks
  trackRef.current = playerState.currentTrack;
  bookRef.current = playerState.currentBook;

  // Refs for native media-notification action handlers (avoid stale closures)
  const onPlayRef = useRef(onPlay);
  const onPauseRef = useRef(onPause);
  const onSkipNextRef = useRef(onSkipNext);
  const onSkipPreviousRef = useRef(onSkipPrevious);
  onPlayRef.current = onPlay;
  onPauseRef.current = onPause;
  onSkipNextRef.current = onSkipNext;
  onSkipPreviousRef.current = onSkipPrevious;

  const isNativePlatform = (): boolean =>
    typeof (window as any).Capacitor?.isNativePlatform === 'function' &&
    !!(window as any).Capacitor?.isNativePlatform?.();

  const cleanupBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  // Initialize Web Audio graph lazily on first user interaction safely
  const initAudioGraph = useCallback(() => {
    if (audioCtxRef.current || !audioRef.current) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const source = ctx.createMediaElementSource(audioRef.current);
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      audioCtxRef.current = ctx;
      sourceNodeRef.current = source;
      biquadFilterRef.current = filter;
      gainNodeRef.current = gain;
    } catch {
      // If Web Audio routing is restricted (CORS or permissions), native audio element is used directly
    }
  }, []);

  // Sync audio source when track or book changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const track = playerState.currentTrack;
    const book = playerState.currentBook;
    if (!track || !track.audioUrl) return;

    // Validate URL before using
    if (!isValidAudioUrl(track.audioUrl)) {
      onError(`Invalid audio URL for "${track.title}". Skipping.`);
      return;
    }

    let isSubscribed = true;

    // Cancel any in-flight blob fetch
    if (abortRef.current) {
      abortRef.current.abort();
    }
    cleanupBlobUrl();

    async function loadAudioSource() {
      let finalUrl = track!.audioUrl;

      // 1. Check if offline cached copy is available
      if (book) {
        try {
          const offlineUrl = await getOfflineAudioTrackUrl(book.id, track!.id, track!.trackNumber);
          if (offlineUrl && isSubscribed) {
            finalUrl = offlineUrl;
            blobUrlRef.current = offlineUrl;
          } else if (offlineUrl) {
            URL.revokeObjectURL(offlineUrl);
          }
        } catch {
          // offline check failed, continue with remote
        }
      }

      if (!isSubscribed) return;

      // Check if URL is different
      const currentSrc = audio!.currentSrc || audio!.src;
      const isSameSource = currentSrc && (currentSrc === finalUrl || currentSrc.endsWith(finalUrl));

      if (!isSameSource) {
        onBuffering(true);
        targetSeekTimeRef.current = playerState.currentTime > 0 ? playerState.currentTime : 0;
        retryCountRef.current = 0;

        audio!.src = finalUrl;
        audio!.load();

        if (playerState.isPlaying) {
          initAudioGraph();
          audio!.play().catch(() => {
            // Autoplay permissions — user interaction needed
          });
        }
      }
    }

    loadAudioSource();

    return () => {
      isSubscribed = false;
    };
  }, [
    playerState.currentTrack?.id,
    playerState.currentBook?.id,
    playerState.currentTrack?.audioUrl,
    initAudioGraph,
    cleanupBlobUrl,
    onError,
  ]);

  // Handle Play/Pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    if (playerState.isPlaying) {
      initAudioGraph();
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [playerState.isPlaying, initAudioGraph]);

  // Sync Equalizer / Voice Enhancer filter preset
  useEffect(() => {
    const filter = biquadFilterRef.current;
    if (!filter) return;

    const preset = playerState.voiceEnhancer;
    switch (preset) {
      case 'voice_boost':
        filter.type = 'peaking';
        filter.frequency.value = 2400;
        filter.Q.value = 1.2;
        filter.gain.value = 6.0;
        break;
      case 'clarity':
        filter.type = 'highshelf';
        filter.frequency.value = 4000;
        filter.gain.value = 5.0;
        break;
      case 'bass_warmth':
        filter.type = 'lowshelf';
        filter.frequency.value = 200;
        filter.gain.value = 5.5;
        break;
      case 'treble_bright':
        filter.type = 'highshelf';
        filter.frequency.value = 6000;
        filter.gain.value = 6.0;
        break;
      case 'noise_reduce':
        filter.type = 'lowpass';
        filter.frequency.value = 5500;
        break;
      case 'off':
      default:
        filter.type = 'allpass';
        filter.gain.value = 0;
        break;
    }
  }, [playerState.voiceEnhancer]);

  // Handle Volume & Sleep Timer Fade-Out
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let targetVolume = playerState.isMuted ? 0 : playerState.volume;

    if (playerState.sleepTimer.isActive && playerState.sleepTimer.remainingSeconds <= 20) {
      const fadeFactor = Math.max(0, playerState.sleepTimer.remainingSeconds / 20);
      targetVolume = targetVolume * fadeFactor;
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = targetVolume;
    } else {
      audio.volume = Math.max(0, Math.min(1, targetVolume));
    }
  }, [
    playerState.volume,
    playerState.isMuted,
    playerState.sleepTimer.isActive,
    playerState.sleepTimer.remainingSeconds,
  ]);

  // Sync playback rate
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playerState.playbackSpeed;
  }, [playerState.playbackSpeed]);

  // Sync seek when currentTime is manually changed from UI
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    if (audio.readyState >= 1) {
      if (Math.abs(audio.currentTime - playerState.currentTime) > 2) {
        audio.currentTime = playerState.currentTime;
      }
    } else {
      targetSeekTimeRef.current = playerState.currentTime;
    }
  }, [playerState.currentTime]);

  // Smart recovery when audio stalls or buffers excessively due to network
  const handleStalledOrWaiting = useCallback(() => {
    onBuffering(true);

    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
    }

    // If buffering takes longer than 4 seconds, try blob fetch fallback (works in Capacitor)
    stallTimerRef.current = setTimeout(async () => {
      const audio = audioRef.current;
      const track = trackRef.current;
      if (!audio || !track) return;

      if (!isValidAudioUrl(track.audioUrl)) return;

      // Try fetching as blob URL (works in Capacitor WebView without CORS proxy)
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const blobUrl = await fetchAudioAsBlobUrl(track.audioUrl, controller.signal);
      if (blobUrl && audioRef.current) {
        targetSeekTimeRef.current = audio.currentTime || playerState.currentTime;
        cleanupBlobUrl();
        blobUrlRef.current = blobUrl;
        audio.src = blobUrl;
        audio.load();
        if (playerState.isPlaying) {
          audio.play().catch(() => {});
        }
      }
    }, 4000);
  }, [onBuffering, playerState.currentTime, playerState.isPlaying, cleanupBlobUrl]);

  const handleCanPlay = useCallback(() => {
    onBuffering(false);
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }

    const audio = audioRef.current;
    if (!audio) return;

    // Apply pending seek position once stream is ready
    if (targetSeekTimeRef.current > 0) {
      try {
        audio.currentTime = targetSeekTimeRef.current;
      } catch {
        // ignore
      }
      targetSeekTimeRef.current = 0;
    }
  }, [onBuffering]);

  const handleAudioError = useCallback(async () => {
    onBuffering(false);
    const track = trackRef.current;
    const audio = audioRef.current;

    // Retry up to 2 times with blob fetch fallback
    if (track && isValidAudioUrl(track.audioUrl) && retryCountRef.current < 2) {
      retryCountRef.current += 1;
      targetSeekTimeRef.current = audio?.currentTime || playerState.currentTime;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const blobUrl = await fetchAudioAsBlobUrl(track.audioUrl, controller.signal);
      if (blobUrl && audioRef.current) {
        cleanupBlobUrl();
        blobUrlRef.current = blobUrl;
        audioRef.current.src = blobUrl;
        audioRef.current.load();
        if (playerState.isPlaying) {
          audioRef.current.play().catch(() => {});
        }
        return;
      }
    }

    const trackTitle = track?.title || 'Unknown';
    onError(`Playback failed for "${trackTitle}". Check your connection and try again.`);
  }, [onBuffering, onError, playerState.currentTime, playerState.isPlaying, cleanupBlobUrl]);

  // --- Media Session API: system notifications & lock-screen controls ---
  useEffect(() => {
    const book = playerState.currentBook;
    const track = playerState.currentTrack;
    if (!('mediaSession' in navigator) || !book) return;

    const ms = navigator.mediaSession;

    // Set metadata (shows in Android notification & lock screen)
    const artworkSrc = book.coverImageUrl || '';
    const artwork: MediaImage[] = artworkSrc
      ? [
          { src: artworkSrc, sizes: '512x512', type: 'image/jpeg' },
          { src: artworkSrc, sizes: '256x256', type: 'image/jpeg' },
          { src: artworkSrc, sizes: '128x128', type: 'image/jpeg' },
        ]
      : [];

    ms.metadata = new MediaMetadata({
      title: track?.title || book.title,
      artist: book.author || 'Unknown Author',
      album: book.title,
      artwork,
    });

    // Register playback action handlers (lock-screen / notification buttons)
    ms.setActionHandler('play', () => onPlay());
    ms.setActionHandler('pause', () => onPause());
    ms.setActionHandler('nexttrack', () => onSkipNext());
    ms.setActionHandler('previoustrack', () => onSkipPrevious());
    ms.setActionHandler('seekbackward', (details) => {
      const offset = details.seekOffset || 15;
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = Math.max(0, audio.currentTime - offset);
      }
    });
    ms.setActionHandler('seekforward', (details) => {
      const offset = details.seekOffset || 30;
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + offset);
      }
    });
    ms.setActionHandler('seekto', (details) => {
      const audio = audioRef.current;
      if (audio && details.fastSeek && 'fastSeek' in audio) {
        audio.fastSeek(details.seekTime ?? 0);
      } else if (audio && details.seekTime != null) {
        audio.currentTime = details.seekTime;
      }
    });

    return () => {
      ms.metadata = null;
      for (const action of ['play', 'pause', 'nexttrack', 'previoustrack', 'seekbackward', 'seekforward', 'seekto'] as const) {
        try { ms.setActionHandler(action, null); } catch {}
      }
    };
  }, [playerState.currentBook?.id, playerState.currentTrack?.id, onPlay, onPause, onSkipNext, onSkipPrevious]);

  // Sync Media Session playback state (playing/paused + position)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    ms.playbackState = playerState.isPlaying ? 'playing' : 'paused';
  }, [playerState.isPlaying]);

  // Periodically update Media Session position so lock-screen scrubber stays current
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const audio = audioRef.current;
    if (!audio) return;

    const updatePosition = () => {
      if (navigator.mediaSession.setPositionState) {
        try {
          const duration = isFinite(audio.duration) ? audio.duration : playerState.duration || 0;
          const position = isFinite(audio.currentTime) ? audio.currentTime : playerState.currentTime || 0;
          navigator.mediaSession.setPositionState({
            duration: Math.max(0, duration),
            playbackRate: playerState.playbackSpeed || 1,
            position: Math.max(0, Math.min(position, duration)),
          });
        } catch {}
      }
    };

    // Update immediately, then every 3 seconds while playing
    updatePosition();
    if (!playerState.isPlaying) return;
    const interval = setInterval(updatePosition, 3000);
    return () => clearInterval(interval);
  }, [playerState.isPlaying, playerState.currentTime, playerState.duration, playerState.playbackSpeed]);

  // --- Native Android media notification (persistent lock-screen + shade) ---
  // Listen for transport actions from the native MediaNotification plugin and
  // route them to the same handlers used by the web Media Session API.
  useEffect(() => {
    if (!isNativePlatform()) return;
    let remove: (() => void) | undefined;

    MediaNotification.addListener('mediaNotificationAction', (e: MediaNotificationAction) => {
      const action = e?.action;
      if (action === 'play') onPlayRef.current();
      else if (action === 'pause') onPauseRef.current();
      else if (action === 'next') onSkipNextRef.current();
      else if (action === 'previous') onSkipPreviousRef.current();
      else if (action === 'seek' && typeof e.position === 'number') {
        const audio = audioRef.current;
        if (audio) audio.currentTime = e.position / 1000;
      }
    }).then((handle: { remove: () => void }) => {
      remove = () => handle.remove();
    }).catch(() => {});

    return () => {
      remove?.();
    };
  }, []);

  // Push current track metadata + playback state to the native notification
  // whenever the book, track, or play/pause state changes.
  useEffect(() => {
    if (!isNativePlatform()) return;
    const book = playerState.currentBook;
    const track = playerState.currentTrack;
    if (!book) return;

    const push = () => {
      MediaNotification.update({
        title: track?.title || book.title,
        artist: book.author || 'Unknown Author',
        album: book.title,
        artworkUrl: book.coverImageUrl || '',
        isPlaying: playerState.isPlaying,
        position: audioRef.current?.currentTime || playerState.currentTime || 0,
        duration: audioRef.current?.duration || playerState.duration || 0,
      });
    };

    if (playerState.isPlaying) {
      MediaNotification.show()
        .then(push)
        .catch(() => push());
    } else {
      push();
    }
  }, [
    playerState.currentBook?.id,
    playerState.currentTrack?.id,
    playerState.isPlaying,
  ]);

  // Keep the native notification's progress position fresh while playing.
  useEffect(() => {
    if (!isNativePlatform() || !playerState.isPlaying) return;
    const id = setInterval(() => {
      const book = bookRef.current;
      const track = trackRef.current;
      if (!book) return;
      MediaNotification.update({
        title: track?.title || book.title,
        artist: book.author || 'Unknown Author',
        album: book.title,
        artworkUrl: book.coverImageUrl || '',
        isPlaying: true,
        position: audioRef.current?.currentTime || 0,
        duration: audioRef.current?.duration || 0,
      });
    }, 5000);
    return () => clearInterval(id);
  }, [playerState.isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      cleanupBlobUrl();
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      if (isNativePlatform()) {
        MediaNotification.hide().catch(() => {});
      }
    };
  }, [cleanupBlobUrl]);

  return (
    <audio
      ref={audioRef}
      id="libriaudio-core-audio-element"
      className="hidden"
      preload="auto"
      crossOrigin="anonymous"
      onTimeUpdate={() => {
        if (audioRef.current) {
          onTimeUpdate(audioRef.current.currentTime, audioRef.current.duration || 0);
        }
      }}
      onWaiting={handleStalledOrWaiting}
      onStalled={handleStalledOrWaiting}
      onPlaying={() => {
        onBuffering(false);
        if (stallTimerRef.current) {
          clearTimeout(stallTimerRef.current);
          stallTimerRef.current = null;
        }
      }}
      onCanPlay={handleCanPlay}
      onLoadedMetadata={handleCanPlay}
      onEnded={onEnded}
      onError={handleAudioError}
    />
  );
};
