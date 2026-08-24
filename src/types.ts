export type AudioQualityPreference = 'auto' | '128k' | '64k';

export interface AudioTrack {
  id: string;
  title: string;
  audioUrl: string;
  durationSeconds: number;
  trackNumber: number;
  sectionNumber?: number;
  quality?: string;
  variants?: { [qualityKey: string]: string };
}

export interface EbookChapter {
  id: string;
  title: string;
  content: string;
  trackId?: string;
}

export interface Audiobook {
  id: string;
  title: string;
  author: string;
  description: string;
  coverImageUrl: string;
  language: string;
  totalTimeSecs: number;
  reader?: string;
  tracks: AudioTrack[];
  availableQualities?: string[];
  qualitySegments?: { [qualityKey: string]: AudioTrack[] };
  selectedQuality?: string;
  gutenbergId?: number;
  ebookUrl?: string;
  ebookChapters?: EbookChapter[];
  status?: 'reading' | 'read' | 'unread';
  lastVisited?: number;
  lastPlayedTrackIndex?: number;
  lastPlayedPositionSecs?: number;
}

export interface EbookReaderSettings {
  fontSize: number; // e.g. 14, 16, 18, 20, 24
  fontFamily: 'serif' | 'sans' | 'mono' | 'literary';
  theme: 'obsidian' | 'sepia' | 'paper' | 'midnight' | 'oled';
  lineHeight: number; // 1.4, 1.7, 2.0
  columnWidth: 'narrow' | 'normal' | 'wide';
  textAlign: 'left' | 'justify';
  swipeDirection: 'natural' | 'reversed';
}

export type HighlightColor = 'gold' | 'emerald' | 'sapphire' | 'amethyst';

export interface EbookAnnotation {
  id: string;
  bookId: string;
  chapterIndex: number;
  chapterTitle: string;
  text: string;
  color: HighlightColor;
  note?: string;
  createdAt: number;
}

export interface EbookBookmark {
  id: string;
  bookId: string;
  chapterIndex: number;
  chapterTitle: string;
  snippet: string;
  scrollPercentage: number;
  createdAt: number;
}

export interface DictionaryDefinition {
  definition: string;
  example?: string;
  synonyms?: string[];
}

export interface DictionaryMeaning {
  partOfSpeech: string;
  definitions: DictionaryDefinition[];
}

export interface DictionaryResult {
  word: string;
  phonetic?: string;
  meanings: DictionaryMeaning[];
}

export type NoteColor = 'default' | 'gold' | 'emerald' | 'sapphire' | 'amethyst' | 'rose';

export interface BookNote {
  id: string;
  bookId: string;
  bookTitle: string;
  author: string;
  title: string;
  content: string;
  trackIndex?: number;
  trackTitle?: string;
  timestamp?: number;
  tags?: string[];
  color?: NoteColor;
  createdAt: number;
  updatedAt: number;
}

export interface Bookmark {
  id: string;
  bookId: string;
  bookTitle: string;
  trackIndex: number;
  trackTitle: string;
  timestamp: number;
  note?: string;
  createdAt: number;
}

export type SleepTimerOption = 5 | 10 | 15 | 30 | 45 | 60 | 90 | 'chapter' | null;

export interface SleepTimerState {
  isActive: boolean;
  totalSeconds: number;
  remainingSeconds: number;
  isEndOfChapter: boolean;
  fadeDurationSecs: number;
}

export type VoiceEnhancerPreset = 'off' | 'voice_boost' | 'clarity' | 'bass_warmth' | 'treble_bright' | 'noise_reduce';

export interface OfflineTrack {
  trackId: string;
  blobUrl?: string;
  sizeBytes: number;
}

export interface OfflineBookData {
  bookId: string;
  book: Audiobook;
  sizeBytes: number;
  downloadedAt: number;
  status: 'downloading' | 'ready' | 'error';
  progress: number; // 0 to 100
}

export interface OfflineEbookData {
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  coverImageUrl?: string;
  chapters: EbookChapter[];
  fullText?: string;
  storedAt: number;
  lastReadChapterIndex: number;
  lastScrollPercentage: number;
  lastReadAt: number;
  sizeBytes: number;
}

export interface ReadingSessionRecord {
  id: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  coverImageUrl?: string;
  chapterIndex: number;
  chapterTitle: string;
  durationSeconds: number; // exact seconds spent reading
  startTimestamp: number;
  endTimestamp: number;
  scrollPercentage?: number;
  date: string; // YYYY-MM-DD
}

export interface PlayerState {
  currentBook: Audiobook | null;
  currentTrack: AudioTrack | null;
  currentTrackIndex: number;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  volume: number;
  isMuted: boolean;
  history: Audiobook[];
  savedBooks: Audiobook[];
  bookmarks: Bookmark[];
  sleepTimer: SleepTimerState;
  voiceEnhancer: VoiceEnhancerPreset;
  isOfflineOnly: boolean;
}

export interface FlutterFile {
  path: string;
  name: string;
  category: 'config' | 'core' | 'catalog' | 'player' | 'home' | 'main' | 'screens' | 'reader' | 'services';
  language: 'yaml' | 'gradle' | 'xml' | 'dart' | 'markdown' | 'json';
  description: string;
  content: string;
}

