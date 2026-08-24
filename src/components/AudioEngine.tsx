import React, { useEffect, useRef, useState } from 'react';
import { PlayerState } from '../types';
import { getOfflineAudioTrackUrl } from '../utils/offlineStorage';

interface AudioEngineProps {
  playerState: PlayerState;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onEnded: () => void;
  onBuffering: (isBuffering: boolean) => void;
  onError: (err: string) => void;
}

export const AudioEngine: React.FC<AudioEngineProps> = ({
  playerState,
  onTimeUpdate,
  onEnded,
  onBuffering,
  onError,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const biquadFilterRef = useRef<BiquadFilterNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const targetSeekTimeRef = useRef<number>(playerState.currentTime || 0);
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [usingProxy, setUsingProxy] = useState<boolean>(false);
  const retryCountRef = useRef<number>(0);

  // Initialize Web Audio graph lazily on first user interaction safely
  const initAudioGraph = () => {
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
  };

  // Sync audio source when track or book changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const track = playerState.currentTrack;
    const book = playerState.currentBook;
    if (!track) return;

    let isSubscribed = true;
    let createdOfflineUrl: string | null = null;

    async function loadAudioSource() {
      let finalUrl = track!.audioUrl;

      // 1. Check if offline cached copy is available
      if (book) {
        try {
          const offlineUrl = await getOfflineAudioTrackUrl(book.id, track!.id, track!.trackNumber);
          if (offlineUrl && isSubscribed) {
            finalUrl = offlineUrl;
            createdOfflineUrl = offlineUrl;
          } else if (offlineUrl) {
            URL.revokeObjectURL(offlineUrl);
          }
        } catch {
          // offline check failed, continue with remote
        }
      }

      if (!isSubscribed) return;

      // If we previously switched to proxy and track changed, reset proxy state
      if (!createdOfflineUrl && usingProxy && !finalUrl.startsWith('/api/proxy-audio')) {
        finalUrl = `/api/proxy-audio?url=${encodeURIComponent(track!.audioUrl)}`;
      }

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
            // Autoplay permissions
          });
        }
      }
    }

    loadAudioSource();

    return () => {
      isSubscribed = false;
      if (createdOfflineUrl) {
        URL.revokeObjectURL(createdOfflineUrl);
      }
    };
  }, [
    playerState.currentTrack?.id,
    playerState.currentBook?.id,
    playerState.currentTrack?.audioUrl,
    usingProxy,
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
      audio.play().catch(() => {
        // Handled
      });
    } else {
      audio.pause();
    }
  }, [playerState.isPlaying]);

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

    // If audio is ready, check difference and seek
    if (audio.readyState >= 1) {
      if (Math.abs(audio.currentTime - playerState.currentTime) > 2) {
        audio.currentTime = playerState.currentTime;
      }
    } else {
      // Store target seek time until metadata is loaded
      targetSeekTimeRef.current = playerState.currentTime;
    }
  }, [playerState.currentTime]);

  // Smart recovery when audio stalls or buffers excessively due to network
  const handleStalledOrWaiting = () => {
    onBuffering(true);

    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
    }

    // If buffering takes longer than 3.5 seconds, auto-switch to backend proxy stream
    stallTimerRef.current = setTimeout(() => {
      const audio = audioRef.current;
      const track = playerState.currentTrack;
      if (!audio || !track) return;

      if (!usingProxy && track.audioUrl.startsWith('http')) {
        console.info('Switching audio stream to high-speed proxy buffer...');
        targetSeekTimeRef.current = audio.currentTime || playerState.currentTime;
        setUsingProxy(true);
        audio.src = `/api/proxy-audio?url=${encodeURIComponent(track.audioUrl)}`;
        audio.load();
        if (playerState.isPlaying) {
          audio.play().catch(() => {});
        }
      }
    }, 3500);
  };

  const handleCanPlay = () => {
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
        if (audio.duration && targetSeekTimeRef.current < audio.duration) {
          audio.currentTime = targetSeekTimeRef.current;
        } else {
          audio.currentTime = targetSeekTimeRef.current;
        }
      } catch {
        // ignore
      }
      targetSeekTimeRef.current = 0;
    }
  };

  const handleAudioError = () => {
    onBuffering(false);
    const track = playerState.currentTrack;
    const audio = audioRef.current;

    // Try proxy fallback on error
    if (!usingProxy && track && track.audioUrl.startsWith('http') && retryCountRef.current < 2) {
      retryCountRef.current += 1;
      targetSeekTimeRef.current = audio?.currentTime || playerState.currentTime;
      setUsingProxy(true);
      if (audio) {
        audio.src = `/api/proxy-audio?url=${encodeURIComponent(track.audioUrl)}`;
        audio.load();
        if (playerState.isPlaying) {
          audio.play().catch(() => {});
        }
      }
      return;
    }

    onError('Audio stream buffering failed. Check network or tap Retry.');
  };

  return (
    <audio
      ref={audioRef}
      id="libriaudio-core-audio-element"
      className="hidden"
      preload="auto"
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
