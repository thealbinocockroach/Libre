import React, { useEffect, useRef, useCallback } from 'react';
import { PlayerState } from '../types';
import { getOfflineAudioTrackUrl } from '../utils/offlineStorage';
import AudioPlaybackNative, { AudioPlaybackEvent } from '../utils/audioPlaybackNative';

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

const isNativePlatform = (): boolean =>
  typeof (window as any).Capacitor?.isNativePlatform === 'function' &&
  !!(window as any).Capacitor?.isNativePlatform?.();

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
  const nativeLoadedUrlRef = useRef<string | null>(null);

  trackRef.current = playerState.currentTrack;
  bookRef.current = playerState.currentBook;

  const onPlayRef = useRef(onPlay);
  const onPauseRef = useRef(onPause);
  const onSkipNextRef = useRef(onSkipNext);
  const onSkipPreviousRef = useRef(onSkipPrevious);
  onPlayRef.current = onPlay;
  onPauseRef.current = onPause;
  onSkipNextRef.current = onSkipNext;
  onSkipPreviousRef.current = onSkipPrevious;

  const cleanupBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

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
    } catch {}
  }, []);

  // ====== NATIVE: ExoPlayer background service ======
  useEffect(() => {
    if (!isNativePlatform()) return;

    const track = playerState.currentTrack;
    const book = playerState.currentBook;
    if (!track || !track.audioUrl) return;
    if (!isValidAudioUrl(track.audioUrl)) {
      onError(`Invalid audio URL for "${track.title}". Skipping.`);
      return;
    }

    let isSubscribed = true;

    async function loadNative() {
      let finalUrl = track!.audioUrl;

      if (book) {
        try {
          const offlineUrl = await getOfflineAudioTrackUrl(book.id, track!.id, track!.trackNumber);
          if (offlineUrl && isSubscribed) {
            finalUrl = offlineUrl;
          }
        } catch {}
      }

      if (!isSubscribed) return;
      if (nativeLoadedUrlRef.current === finalUrl) return;

      nativeLoadedUrlRef.current = finalUrl;
      onBuffering(true);

      try {
        await AudioPlaybackNative.loadTrack({
          url: finalUrl,
          title: track!.title || '',
          artist: book?.author || 'Unknown Author',
          album: book?.title || '',
          artworkUrl: book?.coverImageUrl || '',
          seekTo: playerState.currentTime > 0 ? playerState.currentTime : 0,
          autoPlay: playerState.isPlaying,
        });
      } catch {
        onError(`Failed to load "${track!.title}".`);
      }
    }

    loadNative();
    return () => { isSubscribed = false; };
  }, [
    playerState.currentTrack?.id,
    playerState.currentBook?.id,
    playerState.currentTrack?.audioUrl,
    onError,
  ]);

  // Native: play/pause
  useEffect(() => {
    if (!isNativePlatform()) return;
    if (playerState.isPlaying) {
      AudioPlaybackNative.play().catch(() => {});
    } else {
      AudioPlaybackNative.pause().catch(() => {});
    }
  }, [playerState.isPlaying]);

  // Native: seek
  useEffect(() => {
    if (!isNativePlatform()) return;
    AudioPlaybackNative.seekTo({ position: playerState.currentTime }).catch(() => {});
  }, [playerState.currentTime]);

  // Native: playback rate
  useEffect(() => {
    if (!isNativePlatform()) return;
    AudioPlaybackNative.setPlaybackRate({ rate: playerState.playbackSpeed }).catch(() => {});
  }, [playerState.playbackSpeed]);

  // Native: volume (with sleep-timer fade)
  useEffect(() => {
    if (!isNativePlatform()) return;
    let targetVolume = playerState.isMuted ? 0 : playerState.volume;
    if (playerState.sleepTimer.isActive && playerState.sleepTimer.remainingSeconds <= 20) {
      const fadeFactor = Math.max(0, playerState.sleepTimer.remainingSeconds / 20);
      targetVolume = targetVolume * fadeFactor;
    }
    AudioPlaybackNative.setVolume({ volume: Math.max(0, Math.min(1, targetVolume)) }).catch(() => {});
  }, [
    playerState.volume,
    playerState.isMuted,
    playerState.sleepTimer.isActive,
    playerState.sleepTimer.remainingSeconds,
  ]);

  // Native: listen for events from ExoPlayer service
  useEffect(() => {
    if (!isNativePlatform()) return;
    let handle: { remove: () => void } | undefined;

    AudioPlaybackNative.addListener('audioPlaybackEvent', (e: AudioPlaybackEvent) => {
      switch (e.action) {
        case 'play':
          onPlayRef.current();
          break;
        case 'pause':
          onPauseRef.current();
          break;
        case 'next':
          onSkipNextRef.current();
          break;
        case 'previous':
          onSkipPreviousRef.current();
          break;
        case 'stop':
          onPauseRef.current();
          break;
        case 'ended':
          onEnded();
          break;
        case 'ready':
          onBuffering(false);
          break;
        case 'buffering':
          onBuffering(true);
          break;
        case 'stateChanged':
          if (typeof e.position === 'number' && typeof e.duration === 'number') {
            onTimeUpdate(e.position, e.duration);
          }
          break;
        case 'error':
          onError(e.message || 'Playback error');
          break;
      }
    }).then((h) => { handle = h; }).catch(() => {});

    return () => { handle?.remove(); };
  }, []);

  // Native: cleanup on unmount
  useEffect(() => {
    if (!isNativePlatform()) return;
    return () => {
      AudioPlaybackNative.stop().catch(() => {});
    };
  }, []);

  // ====== WEB: HTML Audio fallback ======
  useEffect(() => {
    if (isNativePlatform()) return;
    const audio = audioRef.current;
    if (!audio) return;

    const track = playerState.currentTrack;
    const book = playerState.currentBook;
    if (!track || !track.audioUrl) return;
    if (!isValidAudioUrl(track.audioUrl)) {
      onError(`Invalid audio URL for "${track.title}". Skipping.`);
      return;
    }

    let isSubscribed = true;

    if (abortRef.current) abortRef.current.abort();
    cleanupBlobUrl();

    async function loadAudioSource() {
      let finalUrl = track!.audioUrl;

      if (book) {
        try {
          const offlineUrl = await getOfflineAudioTrackUrl(book.id, track!.id, track!.trackNumber);
          if (offlineUrl && isSubscribed) {
            finalUrl = offlineUrl;
            blobUrlRef.current = offlineUrl;
          } else if (offlineUrl) {
            URL.revokeObjectURL(offlineUrl);
          }
        } catch {}
      }

      if (!isSubscribed) return;

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
          audio!.play().catch(() => {});
        }
      }
    }

    loadAudioSource();
    return () => { isSubscribed = false; };
  }, [
    playerState.currentTrack?.id,
    playerState.currentBook?.id,
    playerState.currentTrack?.audioUrl,
    initAudioGraph,
    cleanupBlobUrl,
    onError,
  ]);

  useEffect(() => {
    if (isNativePlatform()) return;
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

  useEffect(() => {
    if (isNativePlatform()) return;
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

  useEffect(() => {
    if (isNativePlatform()) return;
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

  useEffect(() => {
    if (isNativePlatform()) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playerState.playbackSpeed;
  }, [playerState.playbackSpeed]);

  useEffect(() => {
    if (isNativePlatform()) return;
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

  const handleStalledOrWaiting = useCallback(() => {
    if (isNativePlatform()) return;
    onBuffering(true);
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    stallTimerRef.current = setTimeout(async () => {
      const audio = audioRef.current;
      const track = trackRef.current;
      if (!audio || !track) return;
      if (!isValidAudioUrl(track.audioUrl)) return;
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
        if (playerState.isPlaying) audio.play().catch(() => {});
      }
    }, 4000);
  }, [onBuffering, playerState.currentTime, playerState.isPlaying, cleanupBlobUrl]);

  const handleCanPlay = useCallback(() => {
    if (isNativePlatform()) return;
    onBuffering(false);
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (targetSeekTimeRef.current > 0) {
      try { audio.currentTime = targetSeekTimeRef.current; } catch {}
      targetSeekTimeRef.current = 0;
    }
  }, [onBuffering]);

  const handleAudioError = useCallback(async () => {
    if (isNativePlatform()) return;
    onBuffering(false);
    const track = trackRef.current;
    const audio = audioRef.current;
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
        if (playerState.isPlaying) audioRef.current.play().catch(() => {});
        return;
      }
    }
    const trackTitle = track?.title || 'Unknown';
    onError(`Playback failed for "${trackTitle}". Check your connection and try again.`);
  }, [onBuffering, onError, playerState.currentTime, playerState.isPlaying, cleanupBlobUrl]);

  // Web Media Session API (skip on native — handled by native MediaSessionCompat)
  useEffect(() => {
    if (isNativePlatform()) return;
    const book = playerState.currentBook;
    const track = playerState.currentTrack;
    if (!('mediaSession' in navigator) || !book) return;
    const ms = navigator.mediaSession;
    const artworkSrc = book.coverImageUrl || '';
    const artwork: MediaImage[] = artworkSrc
      ? [{ src: artworkSrc, sizes: '512x512', type: 'image/jpeg' }]
      : [];
    ms.metadata = new MediaMetadata({
      title: track?.title || book.title,
      artist: book.author || 'Unknown Author',
      album: book.title,
      artwork,
    });
    ms.setActionHandler('play', () => onPlay());
    ms.setActionHandler('pause', () => onPause());
    ms.setActionHandler('nexttrack', () => onSkipNext());
    ms.setActionHandler('previoustrack', () => onSkipPrevious());
    ms.setActionHandler('seekbackward', (details) => {
      const offset = details.seekOffset || 15;
      const audio = audioRef.current;
      if (audio) audio.currentTime = Math.max(0, audio.currentTime - offset);
    });
    ms.setActionHandler('seekforward', (details) => {
      const offset = details.seekOffset || 30;
      const audio = audioRef.current;
      if (audio) audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + offset);
    });
    ms.setActionHandler('seekto', (details) => {
      const audio = audioRef.current;
      if (audio && details.fastSeek && 'fastSeek' in audio) audio.fastSeek(details.seekTime ?? 0);
      else if (audio && details.seekTime != null) audio.currentTime = details.seekTime;
    });
    return () => {
      ms.metadata = null;
      for (const action of ['play', 'pause', 'nexttrack', 'previoustrack', 'seekbackward', 'seekforward', 'seekto'] as const) {
        try { ms.setActionHandler(action, null); } catch {}
      }
    };
  }, [playerState.currentBook?.id, playerState.currentTrack?.id, onPlay, onPause, onSkipNext, onSkipPrevious]);

  useEffect(() => {
    if (isNativePlatform()) return;
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = playerState.isPlaying ? 'playing' : 'paused';
  }, [playerState.isPlaying]);

  useEffect(() => {
    if (isNativePlatform()) return;
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
    updatePosition();
    if (!playerState.isPlaying) return;
    const interval = setInterval(updatePosition, 3000);
    return () => clearInterval(interval);
  }, [playerState.isPlaying, playerState.currentTime, playerState.duration, playerState.playbackSpeed]);

  // Cleanup on unmount (web only)
  useEffect(() => {
    if (isNativePlatform()) return;
    return () => {
      abortRef.current?.abort();
      cleanupBlobUrl();
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    };
  }, [cleanupBlobUrl]);

  if (isNativePlatform()) return null;

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
