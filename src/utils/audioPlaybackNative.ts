import { registerPlugin } from '@capacitor/core';

export interface AudioPlaybackEvent {
  action: string;
  position?: number;
  duration?: number;
  isPlaying?: boolean;
  speed?: number;
  message?: string;
}

export interface AudioPlaybackPluginDef {
  loadTrack(options: {
    url: string;
    title?: string;
    artist?: string;
    album?: string;
    artworkUrl?: string;
    seekTo?: number;
    autoPlay?: boolean;
  }): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seekTo(options: { position: number }): Promise<void>;
  setPlaybackRate(options: { rate: number }): Promise<void>;
  setVolume(options: { volume: number }): Promise<void>;
  setEqualizer(options: { preset: string }): Promise<void>;
  stop(): Promise<void>;
  getPosition(): Promise<{ position: number; duration: number; isPlaying: boolean }>;
  addListener(
    eventName: 'audioPlaybackEvent',
    handler: (event: AudioPlaybackEvent) => void,
  ): Promise<{ remove: () => void }>;
}

const AudioPlaybackNative = registerPlugin<AudioPlaybackPluginDef>('AudioPlayback');

export default AudioPlaybackNative;
