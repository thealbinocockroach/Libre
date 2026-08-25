import { registerPlugin } from '@capacitor/core';

export interface MediaNotificationUpdate {
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  isPlaying: boolean;
  position: number;
  duration: number;
}

export interface MediaNotificationAction {
  action: 'play' | 'pause' | 'next' | 'previous' | 'seek' | 'stop';
  position?: number;
}

const MediaNotification = registerPlugin<any>('MediaNotification');

export default MediaNotification;
