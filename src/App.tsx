import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_AUDIOBOOKS } from './data/mockCatalog';
import { Audiobook, PlayerState, Bookmark as BookmarkType, OfflineBookData, VoiceEnhancerPreset, SleepTimerOption } from './types';
import { ExploreView } from './components/ExploreView';
import { SearchView } from './components/SearchView';
import { LibraryView } from './components/LibraryView';
import { StatsView } from './components/StatsView';
import { SettingsView } from './components/SettingsView';
import { MiniPlayerWidget } from './components/MiniPlayerWidget';
import { FullPlayerModal } from './components/FullPlayerModal';
import { GutenbergReaderModal } from './components/GutenbergReaderModal';
import { AudioEngine } from './components/AudioEngine';
import { SleepTimerModal } from './components/SleepTimerModal';
import { VoiceEnhancerModal } from './components/VoiceEnhancerModal';
import { Skeleton } from './components/Skeleton';
import { BookmarksModal } from './components/BookmarksModal';
import { CarModeModal } from './components/CarModeModal';
import { OfflineManagerModal } from './components/OfflineManagerModal';
import { BookDetailModal } from './components/BookDetailModal';
import { getAllOfflineBooks, isBookOfflineReady } from './utils/offlineStorage';
import { resolveFullTracklist } from './utils/librivoxRecommendations';
import { parseUploadedEpub } from './utils/epubParser';
import { initTheme } from './utils/themeManager';
import {
  applyQualityToAudiobook,
  getSavedQualityPreference,
} from './utils/audioQualityManager';

import {
  Compass,
  Search,
  Bookmark,
  Moon,
  Headphones,
  HardDrive,
  Settings,
  BarChart3,
} from 'lucide-react';
import { AppLogo } from './components/AppLogo';

export default function App() {
  const [activeTab, setActiveTab] = useState<'explore' | 'search' | 'library' | 'stats' | 'settings'>('explore');
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [showEbookReader, setShowEbookReader] = useState(false);
  const [readingBook, setReadingBook] = useState<Audiobook | null>(INITIAL_AUDIOBOOKS[0]);
  const [catalog, setCatalog] = useState<Audiobook[]>(INITIAL_AUDIOBOOKS);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);

  // Modals for playback & storage features
  const [showSleepTimerModal, setShowSleepTimerModal] = useState(false);
  const [showVoiceEnhancerModal, setShowVoiceEnhancerModal] = useState(false);
  const [showBookmarksModal, setShowBookmarksModal] = useState(false);
  const [showCarModeModal, setShowCarModeModal] = useState(false);
  const [showOfflineManagerModal, setShowOfflineManagerModal] = useState(false);
  const [selectedBookForDetails, setSelectedBookForDetails] = useState<Audiobook | null>(null);
  const [showBookDetailModal, setShowBookDetailModal] = useState(false);

  // Offline items state
  const [offlineBooks, setOfflineBooks] = useState<OfflineBookData[]>([]);
  const [isCurrentBookOffline, setIsCurrentBookOffline] = useState(false);

  const loadState = () => {
    try {
      const saved = localStorage.getItem('libriaudio_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          history: parsed.history || [],
          savedBooks: parsed.savedBooks || [],
          bookmarks: parsed.bookmarks || [],
        };
      }
    } catch (e) {}
    return {
      history: [INITIAL_AUDIOBOOKS[0]],
      savedBooks: [INITIAL_AUDIOBOOKS[1]],
      bookmarks: [],
    };
  };

  const loadedInitialState = loadState();

  // Player State
  const [playerState, setPlayerState] = useState<PlayerState>({
    currentBook: loadedInitialState.history.length > 0 ? loadedInitialState.history[0] : INITIAL_AUDIOBOOKS[0],
    currentTrack: loadedInitialState.history.length > 0 ? loadedInitialState.history[0].tracks[0] : INITIAL_AUDIOBOOKS[0].tracks[0] || null,
    currentTrackIndex: 0,
    isPlaying: false,
    isBuffering: false,
    currentTime: 0,
    duration: loadedInitialState.history.length > 0 ? (loadedInitialState.history[0].tracks[0]?.durationSeconds || loadedInitialState.history[0].totalTimeSecs || 1800) : (INITIAL_AUDIOBOOKS[0].tracks[0]?.durationSeconds || INITIAL_AUDIOBOOKS[0].totalTimeSecs || 1800),
    playbackSpeed: 1.0,
    volume: 1.0,
    isMuted: false,
    history: loadedInitialState.history,
    savedBooks: loadedInitialState.savedBooks,
    bookmarks: loadedInitialState.bookmarks,
    sleepTimer: {
      isActive: false,
      totalSeconds: 0,
      remainingSeconds: 0,
      isEndOfChapter: false,
      fadeDurationSecs: 20,
    },
    voiceEnhancer: (localStorage.getItem('libriaudio_eq_preset') as VoiceEnhancerPreset) || 'off',
    isOfflineOnly: false,
  });

  // Initialize Theme on First User Interaction
  useEffect(() => {
    initTheme();
  }, []);

  // Sync Audio Quality Preference Changes dynamically
  useEffect(() => {
    const handleQualityChanged = (e: any) => {
      const quality = e?.detail?.quality || getSavedQualityPreference();
      setPlayerState((prev) => {
        if (!prev.currentBook) return prev;
        const updatedBook = applyQualityToAudiobook(prev.currentBook, quality);
        const updatedTrack =
          updatedBook.tracks[prev.currentTrackIndex] || prev.currentTrack;

        return {
          ...prev,
          currentBook: updatedBook,
          currentTrack: updatedTrack,
        };
      });
    };

    window.addEventListener('libriaudio_quality_changed', handleQualityChanged);
    return () => {
      window.removeEventListener(
        'libriaudio_quality_changed',
        handleQualityChanged
      );
    };
  }, []);


  // Save state
  useEffect(() => {
    try {
      localStorage.setItem(
        'libriaudio_state',
        JSON.stringify({
          history: playerState.history.slice(0, 50),
          savedBooks: playerState.savedBooks,
          bookmarks: playerState.bookmarks,
        })
      );
    } catch (e) {}
  }, [playerState.history, playerState.savedBooks, playerState.bookmarks]);

  // Sync offline status
  useEffect(() => {
    const refreshOfflineList = async () => {
      try {
        const list = await getAllOfflineBooks();
        setOfflineBooks(list);
        if (playerState.currentBook) {
          const isReady = await isBookOfflineReady(playerState.currentBook.id);
          setIsCurrentBookOffline(isReady);
        }
      } catch (err) {
        console.warn('Failed to load offline list:', err);
      }
    };
    refreshOfflineList();
  }, [playerState.currentBook]);

  // Sleep Timer Tick Effect
  useEffect(() => {
    if (!playerState.sleepTimer.isActive || playerState.sleepTimer.isEndOfChapter) return;

    const interval = setInterval(() => {
      setPlayerState((prev) => {
        if (!prev.sleepTimer.isActive) return prev;
        const nextSeconds = prev.sleepTimer.remainingSeconds - 1;
        if (nextSeconds <= 0) {
          return {
            ...prev,
            isPlaying: false,
            sleepTimer: {
              isActive: false,
              durationMinutes: 0,
              remainingSeconds: 0,
              isEndOfChapter: false,
            },
          };
        }
        return {
          ...prev,
          sleepTimer: {
            ...prev.sleepTimer,
            remainingSeconds: nextSeconds,
          },
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [playerState.sleepTimer.isActive, playerState.sleepTimer.isEndOfChapter]);

  const handleSelectBook = (book: Audiobook, trackIndex = 0) => {
    const configuredBook = applyQualityToAudiobook(book);
    const selectedTrack = configuredBook.tracks[trackIndex] || {
      id: `default_${configuredBook.id}`,
      title: `${configuredBook.title} - Complete`,
      audioUrl: configuredBook.tracks[0]?.audioUrl || '',
      durationSeconds: configuredBook.totalTimeSecs || 1800,
      trackNumber: 1,
    };

    setPlayerState((prev) => {
      const alreadyInHistory = prev.history.some((b) => b.id === configuredBook.id);
      const newHistory = alreadyInHistory
        ? [configuredBook, ...prev.history.filter((b) => b.id !== configuredBook.id)]
        : [configuredBook, ...prev.history];

      return {
        ...prev,
        currentBook: configuredBook,
        currentTrack: selectedTrack,
        currentTrackIndex: trackIndex,
        isPlaying: true,
        currentTime: 0,
        duration: selectedTrack.durationSeconds || configuredBook.totalTimeSecs || 1800,
        history: newHistory,
      };
    });

    if (configuredBook.tracks.length <= 1) {
      resolveFullTracklist(configuredBook).then((fullBook) => {
        if (fullBook.tracks.length > 1) {
          setPlayerState((prev) => {
            if (prev.currentBook?.id === configuredBook.id) {
              const activeTrack = fullBook.tracks[trackIndex] || fullBook.tracks[0];
              return {
                ...prev,
                currentBook: fullBook,
                currentTrack: activeTrack,
                duration: activeTrack?.durationSeconds || prev.duration,
              };
            }
            return prev;
          });
        }
      });
    }
  };

  const handleTogglePlayPause = () => {
    setPlayerState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const handleSeek = (seconds: number) => {
    setPlayerState((prev) => ({ ...prev, currentTime: seconds }));
  };

  const handleRewind15 = () => {
    setPlayerState((prev) => ({
      ...prev,
      currentTime: Math.max(0, prev.currentTime - 15),
    }));
  };

  const handleForward30 = () => {
    setPlayerState((prev) => ({
      ...prev,
      currentTime: Math.min(prev.duration, prev.currentTime + 30),
    }));
  };

  const handleSkipNext = () => {
    if (!playerState.currentBook) return;
    const nextIdx = playerState.currentTrackIndex + 1;
    if (nextIdx < playerState.currentBook.tracks.length) {
      handleSelectBook(playerState.currentBook, nextIdx);
    } else {
      setPlayerState((prev) => ({ ...prev, isPlaying: false, currentTime: 0 }));
    }
  };

  const handleSkipPrevious = () => {
    if (!playerState.currentBook) return;
    if (playerState.currentTime > 5 || playerState.currentTrackIndex === 0) {
      handleSeek(0);
    } else {
      const prevIdx = playerState.currentTrackIndex - 1;
      handleSelectBook(playerState.currentBook, prevIdx);
    }
  };

  const handleSetSpeed = (speed: number) => {
    setPlayerState((prev) => ({ ...prev, playbackSpeed: speed }));
  };

  const handleSelectTrack = (trackIndex: number) => {
    if (playerState.currentBook) {
      handleSelectBook(playerState.currentBook, trackIndex);
    }
  };

  const handleToggleSaveBook = (book: Audiobook) => {
    setPlayerState((prev) => {
      const isSaved = prev.savedBooks.some((b) => b.id === book.id);
      const newSaved = isSaved
        ? prev.savedBooks.filter((b) => b.id !== book.id)
        : [book, ...prev.savedBooks];

      return { ...prev, savedBooks: newSaved };
    });
  };

  const handleClearHistory = () => {
    setPlayerState((prev) => ({ ...prev, history: [] }));
  };

  const handleOpenEbookReader = (book: Audiobook) => {
    setReadingBook(book);
    setShowEbookReader(true);
  };

  const handleUploadEpub = (book: Audiobook) => {
    setCatalog((prev) => {
      if (prev.some((b) => b.id === book.id)) return prev;
      return [book, ...prev];
    });
    setPlayerState((prev) => ({
      ...prev,
      savedBooks: [book, ...prev.savedBooks.filter((b) => b.id !== book.id)],
    }));
    handleOpenEbookReader(book);
  };

  const handleOpenBookDetails = (book: Audiobook) => {
    setSelectedBookForDetails(book);
    setShowBookDetailModal(true);
  };

  const handleRefreshFeed = () => {
    setIsLoadingFeed(true);
    setTimeout(() => {
      setCatalog([...INITIAL_AUDIOBOOKS]);
      setIsLoadingFeed(false);
    }, 600);
  };

  // Sleep Timer Handlers
  const handleSetSleepTimer = (option: SleepTimerOption, customMinutes?: number) => {
    if (option === null) {
      handleCancelSleepTimer();
      return;
    }

    if (option === 'chapter') {
      const remainingInTrack = Math.max(0, playerState.duration - playerState.currentTime);
      setPlayerState((prev) => ({
        ...prev,
        sleepTimer: {
          isActive: true,
          totalSeconds: Math.floor(remainingInTrack),
          remainingSeconds: Math.floor(remainingInTrack),
          isEndOfChapter: true,
          fadeDurationSecs: 20,
        },
      }));
      return;
    }

    const minutes = typeof option === 'number' ? option : customMinutes || 15;
    const totalSecs = minutes * 60;
    setPlayerState((prev) => ({
      ...prev,
      sleepTimer: {
        isActive: true,
        totalSeconds: totalSecs,
        remainingSeconds: totalSecs,
        isEndOfChapter: false,
        fadeDurationSecs: 20,
      },
    }));
  };

  const handleCancelSleepTimer = () => {
    setPlayerState((prev) => ({
      ...prev,
      sleepTimer: {
        isActive: false,
        totalSeconds: 0,
        remainingSeconds: 0,
        isEndOfChapter: false,
        fadeDurationSecs: 20,
      },
    }));
  };

  const handleExtendSleepTimer = (minutes: number) => {
    setPlayerState((prev) => ({
      ...prev,
      sleepTimer: {
        ...prev.sleepTimer,
        isActive: true,
        remainingSeconds: prev.sleepTimer.remainingSeconds + minutes * 60,
        isEndOfChapter: false,
      },
    }));
  };

  // Voice Enhancer handler
  const handleSelectVoiceEnhancer = (preset: VoiceEnhancerPreset) => {
    localStorage.setItem('libriaudio_eq_preset', preset);
    setPlayerState((prev) => ({ ...prev, voiceEnhancer: preset }));
  };

  // Bookmarks handlers
  const handleAddBookmark = (note?: string) => {
    if (!playerState.currentBook) return;
    const newBookmark: BookmarkType = {
      id: `bm_${Date.now()}`,
      bookId: playerState.currentBook.id,
      bookTitle: playerState.currentBook.title,
      trackIndex: playerState.currentTrackIndex,
      trackTitle: playerState.currentTrack?.title || `Track ${playerState.currentTrackIndex + 1}`,
      timestamp: Math.floor(playerState.currentTime),
      note,
      createdAt: Date.now(),
    };

    setPlayerState((prev) => ({
      ...prev,
      bookmarks: [newBookmark, ...prev.bookmarks],
    }));
  };

  const handleDeleteBookmark = (id: string) => {
    setPlayerState((prev) => ({
      ...prev,
      bookmarks: prev.bookmarks.filter((b) => b.id !== id),
    }));
  };

  const handleJumpToBookmark = (bm: BookmarkType) => {
    const targetBook = catalog.find((b) => b.id === bm.bookId) || playerState.currentBook;
    if (targetBook) {
      if (playerState.currentBook?.id !== targetBook.id || playerState.currentTrackIndex !== bm.trackIndex) {
        handleSelectBook(targetBook, bm.trackIndex);
      }
      setTimeout(() => {
        handleSeek(bm.timestamp);
      }, 50);
    }
  };

  const isCurrentBookSaved = playerState.currentBook
    ? playerState.savedBooks.some((b) => b.id === playerState.currentBook!.id)
    : false;

  return (
    <div id="libriaudio-app-root" className="fixed inset-0 bg-[#070707] text-[#E0E0E0] flex flex-col font-sans overflow-hidden antialiased select-none">
      {/* Background Audio Engine */}
      <AudioEngine
        playerState={playerState}
        onTimeUpdate={(currentTime, duration) => {
          setPlayerState((prev) => {
            if (prev.currentBook) {
              localStorage.setItem(`libriaudio_pos_${prev.currentBook.id}_${prev.currentTrackIndex}`, currentTime.toString());
            }
            return {
              ...prev,
              currentTime,
              duration: duration > 0 ? duration : prev.duration,
            };
          });
        }}
        onEnded={handleSkipNext}
        onBuffering={(isBuffering) => {
          setPlayerState((prev) => ({ ...prev, isBuffering }));
        }}
        onError={() => {
          setPlayerState((prev) => ({ ...prev, isBuffering: false }));
        }}
      />

      {/* Top Universal App Navigation Bar */}
      <header
        id="app-top-header"
        className="h-16 px-4 md:px-8 border-b border-white/[0.08] bg-[#0A0A0A] flex items-center justify-between shrink-0 z-20"
      >
        {/* Brand Logo & Title (Headphone Gradient Logo) */}
        <div
          onClick={() => setActiveTab('explore')}
          className="flex items-center gap-3 cursor-pointer group"
          title="LibriAudio Home"
        >
          <AppLogo className="w-10 h-10 transition-transform group-hover:scale-105" />
          <div>
            <h1 className="text-lg font-serif-display italic font-bold text-white tracking-wide group-hover:text-[#C5A059] transition-colors">
              LibriAudio
            </h1>
            <p className="text-[11px] text-white/50 hidden md:block">
              Audiobooks & Ebook Reader
            </p>
          </div>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2">
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 relative overflow-hidden bg-[#070707] flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {isLoadingFeed ? (
            <Skeleton />
          ) : (
            <>
              {activeTab === 'explore' && (
                <div className="max-w-6xl mx-auto w-full p-4 md:p-8">
                  <ExploreView
                    books={catalog}
                    currentBook={playerState.currentBook}
                    history={playerState.history}
                    savedBooks={playerState.savedBooks}
                    onSelectBook={handleOpenBookDetails}
                    onReadBook={handleOpenEbookReader}
                    onUploadEpub={handleUploadEpub}
                    isLoading={isLoadingFeed}
                    onRefresh={handleRefreshFeed}
                  />
                </div>
              )}
              {activeTab === 'search' && (
                <div className="max-w-5xl mx-auto w-full p-4 md:p-8">
                  <SearchView
                    allBooks={catalog}
                    onSelectBook={handleOpenBookDetails}
                    onReadBook={handleOpenEbookReader}
                    onUploadEpub={handleUploadEpub}
                  />
                </div>
              )}
              {activeTab === 'library' && (
                <div className="max-w-4xl mx-auto w-full p-4 md:p-8">
                  <LibraryView
                    history={playerState.history}
                    savedBooks={playerState.savedBooks}
                    offlineBooks={offlineBooks}
                    bookmarks={playerState.bookmarks}
                    currentBook={playerState.currentBook}
                    isPlaying={playerState.isPlaying}
                    onSelectBook={handleOpenBookDetails}
                    onReadBook={handleOpenEbookReader}
                    onClearHistory={handleClearHistory}
                    onDeleteBookmark={handleDeleteBookmark}
                    onJumpToBookmark={handleJumpToBookmark}
                    onOpenOfflineManager={() => setShowOfflineManagerModal(true)}
                    onUploadEpub={handleUploadEpub}
                  />
                </div>
              )}
              {activeTab === 'stats' && (
                <div className="max-w-4xl mx-auto w-full p-4 md:p-8">
                  <StatsView
                    history={playerState.history}
                    onSelectBook={handleOpenBookDetails}
                    onPlayBook={(book) => handleSelectBook(book, 0)}
                  />
                </div>
              )}
              {activeTab === 'settings' && (
                <SettingsView onUploadEpub={handleUploadEpub} />
              )}
            </>
          )}
        </div>

        {/* Persistent Bottom Mini Player Widget */}
        <div className="shrink-0 bg-[#0C0C0C] border-t border-white/[0.08] px-4 md:px-8 py-2 z-20">
          <div className="max-w-6xl mx-auto">
            <MiniPlayerWidget
              playerState={playerState}
              onOpenFullPlayer={() => setShowFullPlayer(true)}
              onTogglePlayPause={(e) => {
                e.stopPropagation();
                handleTogglePlayPause();
              }}
              onRewind15={(e) => {
                e.stopPropagation();
                handleRewind15();
              }}
              onOpenEbookReader={(e) => {
                e.stopPropagation();
                handleOpenEbookReader(playerState.currentBook || catalog[0]);
              }}
              onOpenSleepTimer={(e) => {
                e.stopPropagation();
                setShowSleepTimerModal(true);
              }}
            />
          </div>
        </div>

        {/* Sleek Bottom Navigation Bar (Explore, Search, Library, Stats, Settings) */}
        <div className="shrink-0 bg-[#090909] border-t border-white/[0.08] z-20 w-full pb-[env(safe-area-inset-bottom)]">
          <nav
            id="app-bottom-nav"
            className="h-14 flex items-center justify-around px-3 sm:px-8 max-w-xl mx-auto w-full"
          >
            <button
              id="bottom-tab-explore"
              onClick={() => setActiveTab('explore')}
              className={`flex items-center justify-center w-12 sm:w-14 h-10 rounded-2xl transition-all duration-200 ${
                activeTab === 'explore'
                  ? 'bg-[#C5A059] text-black shadow-lg shadow-[#C5A059]/20 scale-105'
                  : 'text-white/40 hover:text-white hover:bg-white/[0.06]'
              }`}
              title="Explore"
              aria-label="Explore"
            >
              <Compass className="w-5 h-5 stroke-[2.2]" />
            </button>

            <button
              id="bottom-tab-search"
              onClick={() => setActiveTab('search')}
              className={`flex items-center justify-center w-12 sm:w-14 h-10 rounded-2xl transition-all duration-200 ${
                activeTab === 'search'
                  ? 'bg-[#C5A059] text-black shadow-lg shadow-[#C5A059]/20 scale-105'
                  : 'text-white/40 hover:text-white hover:bg-white/[0.06]'
              }`}
              title="Search"
              aria-label="Search"
            >
              <Search className="w-5 h-5 stroke-[2.2]" />
            </button>

            <button
              id="bottom-tab-library"
              onClick={() => setActiveTab('library')}
              className={`flex items-center justify-center w-12 sm:w-14 h-10 rounded-2xl transition-all duration-200 ${
                activeTab === 'library'
                  ? 'bg-[#C5A059] text-black shadow-lg shadow-[#C5A059]/20 scale-105'
                  : 'text-white/40 hover:text-white hover:bg-white/[0.06]'
              }`}
              title="Library"
              aria-label="Library"
            >
              <Bookmark className="w-5 h-5 stroke-[2.2]" />
            </button>

            <button
              id="bottom-tab-stats"
              onClick={() => setActiveTab('stats')}
              className={`flex items-center justify-center w-12 sm:w-14 h-10 rounded-2xl transition-all duration-200 ${
                activeTab === 'stats'
                  ? 'bg-[#C5A059] text-black shadow-lg shadow-[#C5A059]/20 scale-105'
                  : 'text-white/40 hover:text-white hover:bg-white/[0.06]'
              }`}
              title="Stats & Author Rankings"
              aria-label="Stats"
            >
              <BarChart3 className="w-5 h-5 stroke-[2.2]" />
            </button>

            <button
              id="bottom-tab-settings"
              onClick={() => setActiveTab('settings')}
              className={`flex items-center justify-center w-12 sm:w-14 h-10 rounded-2xl transition-all duration-200 ${
                activeTab === 'settings'
                  ? 'bg-[#C5A059] text-black shadow-lg shadow-[#C5A059]/20 scale-105'
                  : 'text-white/40 hover:text-white hover:bg-white/[0.06]'
              }`}
              title="Settings & Preferences"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5 stroke-[2.2]" />
            </button>
          </nav>
        </div>
      </main>

      {/* Full Player Modal */}
      {showFullPlayer && (
        <FullPlayerModal
          playerState={playerState}
          onClose={() => setShowFullPlayer(false)}
          onTogglePlayPause={handleTogglePlayPause}
          onSeek={handleSeek}
          onRewind15={handleRewind15}
          onForward30={handleForward30}
          onSkipNext={handleSkipNext}
          onSetSpeed={handleSetSpeed}
          onSelectTrack={handleSelectTrack}
          onToggleSaveBook={handleToggleSaveBook}
          isSaved={isCurrentBookSaved}
          onOpenEbookReader={() => {
            setShowFullPlayer(false);
            handleOpenEbookReader(playerState.currentBook || catalog[0]);
          }}
          onOpenSleepTimer={() => setShowSleepTimerModal(true)}
          onOpenVoiceEnhancer={() => setShowVoiceEnhancerModal(true)}
          onOpenBookmarks={() => setShowBookmarksModal(true)}
          onOpenCarMode={() => setShowCarModeModal(true)}
          onOpenOfflineManager={() => setShowOfflineManagerModal(true)}
          isDownloaded={isCurrentBookOffline}
        />
      )}

      {/* Gutenberg / EPUB Ebook Reader Modal */}
      {showEbookReader && readingBook && (
        <GutenbergReaderModal
          isOpen={showEbookReader}
          book={readingBook}
          onClose={() => setShowEbookReader(false)}
          playerState={playerState}
          onTogglePlayPause={handleTogglePlayPause}
          onSeek={handleSeek}
          onRewind15={handleRewind15}
          onForward30={handleForward30}
          onSkipNext={handleSkipNext}
          onSetSpeed={handleSetSpeed}
        />
      )}

      {/* Sleep Timer Modal */}
      <SleepTimerModal
        isOpen={showSleepTimerModal}
        onClose={() => setShowSleepTimerModal(false)}
        sleepTimer={playerState.sleepTimer}
        onSetTimer={handleSetSleepTimer}
        onCancelTimer={handleCancelSleepTimer}
        onExtendTimer={handleExtendSleepTimer}
      />

      {/* Voice Clarity / EQ Modal */}
      <VoiceEnhancerModal
        isOpen={showVoiceEnhancerModal}
        onClose={() => setShowVoiceEnhancerModal(false)}
        currentPreset={playerState.voiceEnhancer}
        onSelectPreset={handleSelectVoiceEnhancer}
      />

      {/* Bookmarks Modal */}
      <BookmarksModal
        isOpen={showBookmarksModal}
        onClose={() => setShowBookmarksModal(false)}
        book={playerState.currentBook}
        currentTrack={playerState.currentTrack}
        currentTrackIndex={playerState.currentTrackIndex}
        currentTime={playerState.currentTime}
        bookmarks={playerState.bookmarks}
        onAddBookmark={handleAddBookmark}
        onDeleteBookmark={handleDeleteBookmark}
        onJumpToBookmark={handleJumpToBookmark}
      />

      {/* Driving / Car Mode Modal */}
      <CarModeModal
        isOpen={showCarModeModal}
        onClose={() => setShowCarModeModal(false)}
        playerState={playerState}
        onTogglePlayPause={handleTogglePlayPause}
        onRewind15={handleRewind15}
        onForward30={handleForward30}
        onNextTrack={handleSkipNext}
        onPrevTrack={handleSkipPrevious}
        onAddBookmark={() => handleAddBookmark('Saved during car driving mode')}
        onOpenSleepTimer={() => {
          setShowCarModeModal(false);
          setShowSleepTimerModal(true);
        }}
      />

      {/* Offline Storage Download Manager Modal */}
      <OfflineManagerModal
        isOpen={showOfflineManagerModal}
        onClose={() => {
          setShowOfflineManagerModal(false);
          getAllOfflineBooks().then(setOfflineBooks);
        }}
        catalog={catalog}
        isOfflineOnly={playerState.isOfflineOnly}
        onToggleOfflineOnly={() => setPlayerState((prev) => ({ ...prev, isOfflineOnly: !prev.isOfflineOnly }))}
        onSelectBook={handleOpenBookDetails}
        onReadBook={handleOpenEbookReader}
      />

      {/* Book Details & Information Modal */}
      {showBookDetailModal && selectedBookForDetails && (
        <BookDetailModal
          isOpen={showBookDetailModal}
          book={selectedBookForDetails}
          playerState={playerState}
          onClose={() => setShowBookDetailModal(false)}
          onPlayBook={(book, trackIndex = 0) => {
            handleSelectBook(book, trackIndex);
          }}
          onTogglePlayPause={handleTogglePlayPause}
          onOpenEbookReader={handleOpenEbookReader}
          onToggleSaveBook={handleToggleSaveBook}
          isSaved={
            selectedBookForDetails
              ? playerState.savedBooks.some((b) => b.id === selectedBookForDetails.id)
              : false
          }
        />
      )}
    </div>
  );
}
