import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  Type,
  BookOpen,
  Settings2,
  Upload,
  ChevronLeft,
  ChevronRight,
  List,
  Highlighter,
  StickyNote,
  Search,
  Bookmark as BookmarkIcon,
  Copy,
  Check,
  Trash2,
  Share2,
  Download,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  AlignLeft,
  AlignJustify,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Clock,
  CheckCircle2,
  History,
  MoreVertical,
} from 'lucide-react';
import {
  Audiobook,
  EbookChapter,
  EbookReaderSettings,
  HighlightColor,
  EbookAnnotation,
  EbookBookmark,
  PlayerState,
  BookNote,
  NoteColor,
} from '../types';
import { findClassicEbook, fetchEbookContent } from '../data/ebookData';
import { parseUploadedEpub, splitManuscriptIntoChapters } from '../utils/epubParser';
import { cacheEbook, getCachedEbook, updateCachedPosition } from '../utils/ebookCache';
import {
  getOfflineEbook,
  updateEbookReadingPosition,
  formatBytes,
} from '../utils/offlineStorage';
import {
  saveEbookPosition,
  getEbookPosition,
  setBookStatus,
} from '../utils/audioPositionTracker';
import {
  recordTrueReadingTime,
  recordReadingSession,
  formatTrueDuration,
} from '../utils/activityTracker';
import { saveBookNote, deleteBookNote } from '../utils/notesStorage';
import { launchExternalDictionary, extractLookupWord } from '../utils/dictionaryLauncher';
import {
  setBlockNativeSelection,
  getSelectionOffsets,
  getCaretPositionFromCoordinates,
  updateSelectionRangeSafely,
  calculateMenuPosition,
  getWordRangeAtPoint,
  createOrderedRange,
  getRangeBoundaryCaretRect,
} from '../utils/textSelection';

interface GutenbergReaderModalProps {
  isOpen: boolean;
  book: Audiobook;
  onClose: () => void;
  onUploadNewEpub?: (book: Audiobook) => void;
  playerState?: PlayerState;
  onTogglePlayPause?: () => void;
  onSeek?: (seconds: number) => void;
  onRewind15?: () => void;
  onForward30?: () => void;
  onSkipNext?: () => void;
  onSetSpeed?: (speed: number) => void;
}

const DEFAULT_SETTINGS: EbookReaderSettings = {
  fontSize: 18,
  fontFamily: 'serif',
  theme: 'obsidian',
  lineHeight: 1.75,
  columnWidth: 'normal',
  textAlign: 'left',
  swipeDirection: 'natural',
  accentColor: '',
};

const HIGHLIGHT_COLORS: { id: HighlightColor; name: string; bg: string; border: string; dot: string }[] = [
  { id: 'gold', name: 'Gold', bg: 'bg-amber-400/25', border: 'border-amber-400', dot: 'bg-amber-400' },
  { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-400/25', border: 'border-emerald-400', dot: 'bg-emerald-400' },
  { id: 'sapphire', name: 'Sapphire', bg: 'bg-blue-400/25', border: 'border-blue-400', dot: 'bg-blue-400' },
  { id: 'amethyst', name: 'Amethyst', bg: 'bg-purple-400/25', border: 'border-purple-400', dot: 'bg-purple-400' },
];

const SHARED_HIGHLIGHT_COLORS: HighlightColor[] = ['gold', 'emerald', 'sapphire', 'amethyst'];

function escapeHtmlText(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Derive a usable white/black text color (--on-accent) from a hex accent
function accentVector(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function lightenHex(hex: string, amt: number): string {
  const [r, g, b] = accentVector(hex);
  const mix = (v: number) =>
    Math.round(v + (255 - v) * amt).toString(16).padStart(2, '0');
  return `#${mix(r)}${mix(g)}${mix(b)}`;
}

function onAccentFor(hex: string): string {
  const [r, g, b] = accentVector(hex);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b);
  return lum > 140 ? '#0A0A0A' : '#FFFFFF';
}

function mapHighlightToNoteColor(color: HighlightColor): NoteColor {
  return (SHARED_HIGHLIGHT_COLORS.includes(color) ? color : 'default') as NoteColor;
}

function mapNoteColorToHighlight(color?: NoteColor): HighlightColor {
  return color && SHARED_HIGHLIGHT_COLORS.includes(color as HighlightColor)
    ? (color as HighlightColor)
    : 'gold';
}

export const GutenbergReaderModal: React.FC<GutenbergReaderModalProps> = ({
  isOpen,
  book,
  onClose,
  onUploadNewEpub,
  playerState,
  onTogglePlayPause,
  onSeek,
  onRewind15,
  onForward30,
  onSkipNext,
  onSetSpeed,
}) => {
  const [currentBook, setCurrentBook] = useState<Audiobook>(book);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Settings & Appearance
  const [settings, setSettings] = useState<EbookReaderSettings>(() => {
    try {
      const saved = localStorage.getItem('libriaudio_reader_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [showThreeDotMenu, setShowThreeDotMenu] = useState(false);

  // Annotations & Bookmarks
  const [annotations, setAnnotations] = useState<EbookAnnotation[]>([]);
  const [bookmarks, setBookmarks] = useState<EbookBookmark[]>([]);
  const [activeSidebarTab, setActiveSidebarTab] = useState<
    'chapters' | 'highlights' | 'search' | 'bookmarks' | null
  >(null);

  // Selection Floating Menu
  const [selectionMenu, setSelectionMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    text: string;
    startChar?: number;
    endChar?: number;
    handleStart?: { x: number; y: number };
    handleEnd?: { x: number; y: number };
  } | null>(null);

  // Add / Edit Note Dialog
  const [noteDialog, setNoteDialog] = useState<{
    isOpen: boolean;
    annotationId?: string;
    text: string;
    note: string;
    color: HighlightColor;
    startChar?: number;
    endChar?: number;
  } | null>(null);

  // Selected highlight bubble when clicking highlighted text
  const [activeHighlightPopup, setActiveHighlightPopup] = useState<{
    annotation: EbookAnnotation;
    x: number;
    y: number;
  } | null>(null);

  // In-Book Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [searchFilterChapterOnly, setSearchFilterChapterOnly] = useState(false);

  // Reading progress stats
  const [scrollProgress, setScrollProgress] = useState(0);
  const [copiedState, setCopiedState] = useState(false);
  const [isStoredOffline, setIsStoredOffline] = useState(false);
  const [storedSizeBytes, setStoredSizeBytes] = useState<number>(0);
  const [sessionReadingSeconds, setSessionReadingSeconds] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const sessionSecondsRef = useRef<number>(0);
  const lastFlushedSecondsRef = useRef<number>(0);
  const sessionStartScrollRef = useRef<number>(0);
  const targetScrollPercentageRef = useRef<number>(0);
  const isRestoringPositionRef = useRef<boolean>(false);
  // Persisted native selection range: kept alive while the floating menu is
  // open so taps on the menu don't collapse the highlight.
  const selectionRangeRef = useRef<Range | null>(null);
  const selectionClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleDragRef = useRef<{ which: 'start' | 'end'; anchorContainer: Node; anchorOffset: number } | null>(null);
  const [activeDraggingHandle, setActiveDraggingHandle] = useState<'start' | 'end' | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerDownPosRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isHoldSelectingRef = useRef<boolean>(false);
  const holdAnchorRef = useRef<{ node: Node; offset: number } | null>(null);

  // Swipe gesture tracking for chapter navigation
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  // Suppress native Android ActionMode toolbar when the ebook reader is open
  useEffect(() => {
    if (isOpen) {
      setBlockNativeSelection(true);
    } else {
      setBlockNativeSelection(false);
    }
    return () => {
      setBlockNativeSelection(false);
    };
  }, [isOpen]);

  // Sync currentBook when prop changes and restore saved reading position
  useEffect(() => {
    setCurrentBook(book);
    if (!isOpen) return;

    // Check saved reading position from persistent storage
    const saved = getEbookPosition(book.id);
    if (saved && saved.chapterIndex >= 0) {
      setCurrentChapterIndex(saved.chapterIndex);
      targetScrollPercentageRef.current = saved.scrollPercentage || 0;
      isRestoringPositionRef.current = true;
    } else {
      getOfflineEbook(book.id).then((stored) => {
        if (stored && stored.lastReadChapterIndex !== undefined) {
          setCurrentChapterIndex(stored.lastReadChapterIndex);
          targetScrollPercentageRef.current = stored.lastScrollPercentage || 0;
          isRestoringPositionRef.current = true;
        } else {
          setCurrentChapterIndex(0);
          targetScrollPercentageRef.current = 0;
        }
      });
    }
  }, [book.id, isOpen]);

  // Load Annotations & Bookmarks from localStorage
  useEffect(() => {
    if (!currentBook.id) return;
    try {
      const savedAnn = localStorage.getItem(`libriaudio_ann_${currentBook.id}`);
      if (savedAnn) setAnnotations(JSON.parse(savedAnn));
      else setAnnotations([]);

      const savedBm = localStorage.getItem(`libriaudio_bm_${currentBook.id}`);
      if (savedBm) setBookmarks(JSON.parse(savedBm));
      else setBookmarks([]);
    } catch (e) {
      console.warn('Failed to load annotations from localStorage', e);
    }
  }, [currentBook.id]);

  // Clear the native selection when the chapter or a layout-affecting setting
  // changes (the selection highlight + custom menu would otherwise become stale).
  useEffect(() => {
    if (!isOpen) return;
    clearSelectionState();
  }, [currentChapterIndex, settings.fontSize, settings.lineHeight, settings.columnWidth, settings.fontFamily]);


  // Keep annotations in sync with edits/deletes made in the global BookNotesModal
  useEffect(() => {
    const onNotesUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      if (detail.deletedId) {
        setAnnotations((prev) => prev.filter((a) => a.id !== detail.deletedId));
        return;
      }
      const note = detail as BookNote;
      if (note && note.id && note.bookId === currentBook.id) {
        setAnnotations((prev) =>
          prev.map((a) =>
            a.id === note.id
              ? { ...a, note: note.content, color: mapNoteColorToHighlight(note.color) }
              : a
          )
        );
      }
    };
    window.addEventListener('libriaudio_notes_updated', onNotesUpdated as EventListener);
    return () =>
      window.removeEventListener('libriaudio_notes_updated', onNotesUpdated as EventListener);
  }, [currentBook.id]);

  // Save Annotations
  const saveAnnotations = useCallback(
    (newAnnotations: EbookAnnotation[]) => {
      setAnnotations(newAnnotations);
      try {
        localStorage.setItem(`libriaudio_ann_${currentBook.id}`, JSON.stringify(newAnnotations));
      } catch (e) {
        console.warn('Failed to save annotations', e);
      }
    },
    [currentBook.id]
  );

  // Save Bookmarks
  const saveBookmarks = useCallback(
    (newBookmarks: EbookBookmark[]) => {
      setBookmarks(newBookmarks);
      try {
        localStorage.setItem(`libriaudio_bm_${currentBook.id}`, JSON.stringify(newBookmarks));
      } catch (e) {
        console.warn('Failed to save bookmarks', e);
      }
    },
    [currentBook.id]
  );

  // Persist Settings
  const updateSettings = (partial: Partial<EbookReaderSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem('libriaudio_reader_settings', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };


  // Active Reading Session Timer & True Duration Logging
  useEffect(() => {
    if (!isOpen) return;

    sessionStartRef.current = Date.now();
    sessionSecondsRef.current = 0;
    lastFlushedSecondsRef.current = 0;
    sessionStartScrollRef.current = scrollProgress;
    setSessionReadingSeconds(0);

    const timer = setInterval(() => {
      if (document.hidden) return; // Only count while active/visible

      sessionSecondsRef.current += 1;
      setSessionReadingSeconds(sessionSecondsRef.current);

      // Flush every 8 seconds to activity tracker and persist reading position
      if (sessionSecondsRef.current - lastFlushedSecondsRef.current >= 8) {
        const delta = sessionSecondsRef.current - lastFlushedSecondsRef.current;
        lastFlushedSecondsRef.current = sessionSecondsRef.current;

        const currentChapterTitle =
          currentBook.ebookChapters?.[currentChapterIndex]?.title ||
          `Chapter ${currentChapterIndex + 1}`;

        recordTrueReadingTime(
          currentBook,
          delta,
          currentChapterIndex,
          currentChapterTitle,
          scrollProgress
        );

        updateEbookReadingPosition(currentBook.id, currentChapterIndex, scrollProgress);
      }
    }, 1000);

    return () => {
      clearInterval(timer);

      const remainingDelta = sessionSecondsRef.current - lastFlushedSecondsRef.current;
      const currentChapterTitle =
        currentBook.ebookChapters?.[currentChapterIndex]?.title ||
        `Chapter ${currentChapterIndex + 1}`;

      if (remainingDelta > 0) {
        recordTrueReadingTime(
          currentBook,
          remainingDelta,
          currentChapterIndex,
          currentChapterTitle,
          scrollProgress
        );
      }

      // Record a discrete session log if user read for at least 3 seconds
      if (sessionSecondsRef.current >= 3) {
        const wordsInChapter = readingStats.words;
        const scrollDelta = Math.abs(scrollProgress - sessionStartScrollRef.current) / 100;
        const wordsRead = Math.round(wordsInChapter * scrollDelta);

        recordReadingSession({
          bookId: currentBook.id,
          bookTitle: currentBook.title,
          bookAuthor: currentBook.author,
          coverImageUrl: currentBook.coverImageUrl,
          chapterIndex: currentChapterIndex,
          chapterTitle: currentChapterTitle,
          durationSeconds: sessionSecondsRef.current,
          wordsRead: wordsRead > 0 ? wordsRead : undefined,
          startTimestamp: sessionStartRef.current,
          endTimestamp: Date.now(),
          scrollPercentage: scrollProgress,
        });
      }

      updateEbookReadingPosition(currentBook.id, currentChapterIndex, scrollProgress);
    };
  }, [isOpen, currentBook.id, currentChapterIndex]);

  // Fetch or extract reader content (with IndexedDB cache-first strategy)
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    const loadContent = async () => {
      setIsLoading(true);
      setError(null);
      setSelectionMenu(null);
      setActiveHighlightPopup(null);

      // 1. Check ebook cache first (instant offline availability)
      try {
        const cached = await getCachedEbook(currentBook.id);
        if (cached && cached.chapters && cached.chapters.length > 0) {
          if (isMounted) {
            // Re-parse raw text so fixes to paragraph/single-newline handling
            // (and older corrupted caches with stray <br/>) are applied universally.
            let chapters = cached.chapters;
            if (
              cached.format === 'txt' &&
              cached.fullText &&
              cached.fullText.trim().length > 500
            ) {
              try {
                const reparsed = splitManuscriptIntoChapters(
                  cached.fullText,
                  currentBook.title
                );
                if (reparsed.length > 0 && reparsed.length === cached.chapters.length) {
                  chapters = reparsed;
                  cacheEbook(
                    currentBook.id,
                    cached.fullText,
                    reparsed,
                    'txt',
                    cached.sourceUrl || '',
                    currentBook.gutenbergId
                  );
                }
              } catch (e) {
                console.warn('Re-parse failed, falling back to cached chapters', e);
              }
            }

            setCurrentBook((prev) => ({ ...prev, ebookChapters: chapters }));
            const targetIndex =
              currentChapterIndex < chapters.length
                ? currentChapterIndex
                : 0;
            const activeChapter = chapters[targetIndex] || chapters[0];
            setHtmlContent(activeChapter.content);
            setIsStoredOffline(true);
            setIsLoading(false);
          }
          return;
        }
      } catch (e) {
        console.warn('Error checking ebook cache:', e);
      }

      // 2. Check offline storage (legacy path from previous offline downloads)
      try {
        const storedEbook = await getOfflineEbook(currentBook.id);
        if (storedEbook && storedEbook.chapters && storedEbook.chapters.length > 0) {
          if (isMounted) {
            setCurrentBook((prev) => ({ ...prev, ebookChapters: storedEbook.chapters }));
            const targetIndex =
              currentChapterIndex < storedEbook.chapters.length
                ? currentChapterIndex
                : storedEbook.lastReadChapterIndex || 0;
            const activeChapter = storedEbook.chapters[targetIndex] || storedEbook.chapters[0];
            setHtmlContent(activeChapter.content);
            setIsStoredOffline(true);
            setStoredSizeBytes(storedEbook.sizeBytes || 0);
            // Migrate to new cache
            cacheEbook(currentBook.id, storedEbook.fullText || '', storedEbook.chapters, 'txt', '', currentBook.gutenbergId);
            setIsLoading(false);
          }
          return;
        }
      } catch (e) {
        console.warn('Error checking offline stored ebook:', e);
      }

      // 3. If book has pre-parsed ebookChapters (e.g. from uploaded EPUB)
      if (currentBook.ebookChapters && currentBook.ebookChapters.length > 0) {
        const activeChapter =
          currentBook.ebookChapters[currentChapterIndex] || currentBook.ebookChapters[0];
        if (isMounted) {
          setHtmlContent(activeChapter.content);
          setIsLoading(false);
          // Cache for next time
          cacheEbook(currentBook.id, activeChapter.content, currentBook.ebookChapters, 'epub', '', currentBook.gutenbergId);
          setIsStoredOffline(true);
        }
        return;
      }

      // 4. Network fetch: Gutendex API lookup + format fallback chain
      try {
        const classic = findClassicEbook(currentBook);
        const gutenbergId = classic?.gutenbergId || currentBook.gutenbergId;

        const result = await fetchEbookContent(gutenbergId, currentBook.title);

        if (!result) {
          throw new Error('No public digital manuscript found for this title on Project Gutenberg. Try uploading a local EPUB or TXT file.');
        }

        if (isMounted) {
          const parsedChapters = splitManuscriptIntoChapters(result.text, currentBook.title);
          setCurrentBook((prev) => ({ ...prev, ebookChapters: parsedChapters }));
          const activeChapter = parsedChapters[currentChapterIndex] || parsedChapters[0];
          const contentToRender = activeChapter ? activeChapter.content : result.text;
          setHtmlContent(contentToRender);

          // Cache for instant offline access next time
          cacheEbook(currentBook.id, result.text, parsedChapters, result.format, result.sourceUrl, result.gutenbergId);
          setIsStoredOffline(true);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error loading text.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadContent();

    return () => {
      isMounted = false;
    };
  }, [currentBook.id, currentChapterIndex, isOpen]);

  // Scroll restoration or scroll to top when chapter changes
  useEffect(() => {
    if (!contentContainerRef.current || !htmlContent) return;

    if (targetScrollPercentageRef.current > 0) {
      const pct = targetScrollPercentageRef.current;
      const timer = setTimeout(() => {
        if (contentContainerRef.current) {
          const { scrollHeight, clientHeight } = contentContainerRef.current;
          const maxScroll = scrollHeight - clientHeight;
          if (maxScroll > 0) {
            contentContainerRef.current.scrollTop = (maxScroll * pct) / 100;
          }
        }
        targetScrollPercentageRef.current = 0;
        isRestoringPositionRef.current = false;
      }, 120);
      return () => clearTimeout(timer);
    } else if (!isRestoringPositionRef.current) {
      contentContainerRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [currentChapterIndex, htmlContent]);

  // Track scroll reading progress
  const handleScroll = () => {
    if (!contentContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = contentContainerRef.current;
    const maxScroll = scrollHeight - clientHeight;
    const progress =
      maxScroll <= 0 ? 100 : Math.min(100, Math.max(0, Math.round((scrollTop / maxScroll) * 100)));
    setScrollProgress(progress);

    saveEbookPosition(
      currentBook.id,
      currentChapterIndex,
      progress,
      currentBook.ebookChapters?.length || 1
    );
    updateEbookReadingPosition(currentBook.id, currentChapterIndex, progress);
    updateCachedPosition(currentBook.id, currentChapterIndex, progress);

    if (activeHighlightPopup) setActiveHighlightPopup(null);
    if (selectionMenu && selectionRangeRef.current) {
      // Re-position floating menu smoothly on scroll instead of wiping selection
      requestAnimationFrame(() => showSelectionMenuFromNative());
    }
  };

  // Clear native selection + hide floating menu.
  const clearSelectionState = useCallback(() => {
    if (selectionClearTimerRef.current) {
      clearTimeout(selectionClearTimerRef.current);
      selectionClearTimerRef.current = null;
    }
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    isHoldSelectingRef.current = false;
    holdAnchorRef.current = null;
    handleDragRef.current = null;
    setActiveDraggingHandle(null);
    selectionRangeRef.current = null;
    setSelectionMenu(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  // Show the floating menu from the browser's native selection or active stored range.
  const showSelectionMenuFromNative = useCallback(() => {
    const sel = window.getSelection();
    let range: Range | null = null;
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      range = sel.getRangeAt(0);
    } else if (selectionRangeRef.current && !selectionRangeRef.current.collapsed) {
      range = selectionRangeRef.current;
    }
    if (!range) return;

    const text = range.toString().trim();
    if (!text) return;
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    let startChar: number | undefined;
    let endChar: number | undefined;

    const articleEl = articleRef.current;
    if (articleEl) {
      const offsets = getSelectionOffsets(range, articleEl);
      if (offsets) {
        startChar = offsets.start;
        endChar = offsets.end;
      }
    }

    // Compute handle positions from the selection's start/end carets (hang down from line bottom)
    const startCaret = getRangeBoundaryCaretRect(range, 'start');
    const endCaret = getRangeBoundaryCaretRect(range, 'end');

    const handleStart = startCaret || { x: rect.left, y: rect.bottom };
    const handleEnd = endCaret || { x: rect.right, y: rect.bottom };

    const menuPos = calculateMenuPosition(rect, 320, 48);

    selectionRangeRef.current = range.cloneRange();
    setSelectionMenu({
      visible: true,
      x: menuPos.x,
      y: menuPos.y,
      text,
      startChar,
      endChar,
      handleStart,
      handleEnd,
    });
  }, []);

  // Handle drag to extend / adjust selection
  const onHandleDragStart = useCallback((which: 'start' | 'end', clientX: number, clientY: number, e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const sel = window.getSelection();
    let range = selectionRangeRef.current;
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      range = sel.getRangeAt(0);
    }
    if (!range) return;

    const anchorContainer = which === 'start' ? range.endContainer : range.startContainer;
    const anchorOffset = which === 'start' ? range.endOffset : range.startOffset;
    handleDragRef.current = { which, anchorContainer, anchorOffset };
    setActiveDraggingHandle(which);
  }, []);

  const onHandleDragMove = useCallback((clientX: number, clientY: number) => {
    const drag = handleDragRef.current;
    if (!drag) return;

    // Sample 24px above the finger (into the stem/text line) so it hits the actual text rather than the handle bulb
    const sampleY = clientY - 24;
    const pos = getCaretPositionFromCoordinates(clientX, sampleY, articleRef.current);
    if (!pos || !pos.node) return;

    let targetNode = pos.node;
    let targetOffset = pos.offset;

    // Prevent collapsing or inverting the anchor handle
    if (drag.which === 'end') {
      if (targetNode === drag.anchorContainer && targetOffset <= drag.anchorOffset) {
        targetOffset = Math.min((drag.anchorContainer.textContent?.length || drag.anchorOffset + 1), drag.anchorOffset + 1);
      }
    } else if (drag.which === 'start') {
      if (targetNode === drag.anchorContainer && targetOffset >= drag.anchorOffset) {
        targetOffset = Math.max(0, drag.anchorOffset - 1);
      }
    }

    const updatedRange = createOrderedRange(drag.anchorContainer, drag.anchorOffset, targetNode, targetOffset);
    if (updatedRange && !updatedRange.collapsed) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(updatedRange);
      selectionRangeRef.current = updatedRange.cloneRange();
      showSelectionMenuFromNative();
    }
  }, [showSelectionMenuFromNative]);

  const onHandleDragEnd = useCallback(() => {
    handleDragRef.current = null;
    setActiveDraggingHandle(null);
    showSelectionMenuFromNative();
  }, [showSelectionMenuFromNative]);

  // Global pointer & touch listeners for selection handle dragging
  useEffect(() => {
    if (!isOpen) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!handleDragRef.current) return;
      // When dragging a selection handle, pointer capture retargets the event
      // to the handle element (which lives outside <article>). The containment
      // check below would wrongly block extension, so only apply it to
      // non-handle gestures. During a handle drag we always extend.
      onHandleDragMove(e.clientX, e.clientY);
    };
    const onPointerUp = () => {
      if (handleDragRef.current) {
        onHandleDragEnd();
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (handleDragRef.current && e.touches[0]) {
        if (e.cancelable) e.preventDefault();
        onHandleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchEnd = () => {
      if (handleDragRef.current) {
        onHandleDragEnd();
      }
    };

    // Attach listeners
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
  }, [isOpen, onHandleDragMove, onHandleDragEnd]);

  // Hold-to-select and Drag-to-select gestures on manuscript text
  const handleReaderPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('.reader-select-handle') ||
      target.closest('#reader-floating-selection-menu') ||
      target.closest('.libriaudio-hl') ||
      target.closest('button') ||
      target.closest('input')
    ) {
      return;
    }

    pointerDownPosRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      if (!pointerDownPosRef.current) return;

      const wordRange = getWordRangeAtPoint(
        pointerDownPosRef.current.x,
        pointerDownPosRef.current.y,
        articleRef.current
      );

      if (wordRange && !wordRange.collapsed) {
        isHoldSelectingRef.current = true;
        holdAnchorRef.current = {
          node: wordRange.startContainer,
          offset: wordRange.startOffset,
        };

        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(wordRange);
        selectionRangeRef.current = wordRange.cloneRange();

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate(35);
          } catch {
            // ignore
          }
        }

        showSelectionMenuFromNative();
      }
    }, 320);
  }, [showSelectionMenuFromNative]);

  const handleReaderPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isHoldSelectingRef.current) {
      if (pointerDownPosRef.current && longPressTimerRef.current) {
        const dist = Math.hypot(
          e.clientX - pointerDownPosRef.current.x,
          e.clientY - pointerDownPosRef.current.y
        );
        if (dist > 8) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
      return;
    }

    // Is hold selecting: dynamically expand selection to current pointer position
    e.preventDefault();
    const pos = getCaretPositionFromCoordinates(e.clientX, e.clientY, articleRef.current);
    if (!pos || !holdAnchorRef.current) return;

    const newRange = createOrderedRange(
      holdAnchorRef.current.node,
      holdAnchorRef.current.offset,
      pos.node,
      pos.offset
    );

    if (newRange && !newRange.collapsed) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(newRange);
      selectionRangeRef.current = newRange.cloneRange();
      showSelectionMenuFromNative();
    }
  }, [showSelectionMenuFromNative]);

  const handleReaderPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (isHoldSelectingRef.current) {
      isHoldSelectingRef.current = false;
      holdAnchorRef.current = null;
      showSelectionMenuFromNative();
      return;
    }

    // Quick tap dismissal when clicking blank body text outside selection
    if (pointerDownPosRef.current && selectionMenu) {
      const dist = Math.hypot(
        e.clientX - pointerDownPosRef.current.x,
        e.clientY - pointerDownPosRef.current.y
      );
      const elapsed = Date.now() - pointerDownPosRef.current.time;

      const target = e.target as HTMLElement;
      if (
        dist < 8 &&
        elapsed < 300 &&
        !target.closest('#reader-floating-selection-menu') &&
        !target.closest('.reader-select-handle') &&
        !target.closest('.libriaudio-hl') &&
        !target.closest('button')
      ) {
        clearSelectionState();
      }
    }

    pointerDownPosRef.current = null;
  }, [selectionMenu, showSelectionMenuFromNative, clearSelectionState]);

  const handleReaderPointerCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    isHoldSelectingRef.current = false;
    holdAnchorRef.current = null;
    pointerDownPosRef.current = null;
  }, []);

  // Show floating toolbar on native text selection
  useEffect(() => {
    if (!isOpen) return;
    const onSelectionChange = () => {
      // Don't disturb active handle dragging or hold selecting
      if (handleDragRef.current || isHoldSelectingRef.current) return;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        return;
      }
      const text = sel.toString().trim();
      if (!text) return;

      requestAnimationFrame(() => showSelectionMenuFromNative());
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      if (selectionClearTimerRef.current) clearTimeout(selectionClearTimerRef.current);
    };
  }, [isOpen, showSelectionMenuFromNative]);

  const handleDictionaryLookup = async (rawText: string) => {
    const word = extractLookupWord(rawText);
    if (!word) return;
    await launchExternalDictionary(word);
    clearSelectionState();
  };

  // Helper to extract offsets from selection menu or live range
  const getEffectiveSelectionOffsets = () => {
    let startChar = selectionMenu?.startChar;
    let endChar = selectionMenu?.endChar;
    if (typeof startChar !== 'number' || typeof endChar !== 'number') {
      if (selectionRangeRef.current && articleRef.current) {
        const offsets = getSelectionOffsets(selectionRangeRef.current, articleRef.current);
        if (offsets) {
          startChar = offsets.start;
          endChar = offsets.end;
        }
      }
    }
    return { startChar, endChar };
  };

  // Create Highlight
  const createHighlight = (color: HighlightColor) => {
    if (!selectionMenu || !selectionMenu.text) return;
    const currentChapterTitle =
      currentBook.ebookChapters?.[currentChapterIndex]?.title ||
      `Chapter ${currentChapterIndex + 1}`;
    const { startChar, endChar } = getEffectiveSelectionOffsets();
    const hasOffsets = typeof startChar === 'number' && typeof endChar === 'number';

    const newAnnotation: EbookAnnotation = {
      id: `ann_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      bookId: currentBook.id,
      chapterIndex: currentChapterIndex,
      chapterTitle: currentChapterTitle,
      text: selectionMenu.text,
      color,
      createdAt: Date.now(),
      ...(hasOffsets ? { startChar, endChar } : {}),
    };

    saveAnnotations([...annotations, newAnnotation]);
    clearSelectionState();
  };

  // Bookmark the currently selected text (highlights it + stores a text bookmark)
  const bookmarkFromSelection = () => {
    if (!selectionMenu || !selectionMenu.text) return;
    const chapterTitle =
      currentBook.ebookChapters?.[currentChapterIndex]?.title ||
      `Chapter ${currentChapterIndex + 1}`;
    const { startChar, endChar } = getEffectiveSelectionOffsets();
    const hasOffsets = typeof startChar === 'number' && typeof endChar === 'number';

    const newAnnotation: EbookAnnotation = {
      id: `ann_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      bookId: currentBook.id,
      chapterIndex: currentChapterIndex,
      chapterTitle,
      text: selectionMenu.text,
      color: 'gold',
      createdAt: Date.now(),
      ...(hasOffsets ? { startChar, endChar } : {}),
    };
    saveAnnotations([...annotations, newAnnotation]);

    const newBm: EbookBookmark = {
      id: `bm_${Date.now()}`,
      bookId: currentBook.id,
      chapterIndex: currentChapterIndex,
      chapterTitle,
      snippet: selectionMenu.text,
      scrollPercentage: scrollProgress,
      createdAt: Date.now(),
    };
    saveBookmarks([newBm, ...bookmarks]);

    clearSelectionState();
    setActiveSidebarTab('bookmarks');
  };

  // Open Note Creator from selection
  const openNoteFromSelection = () => {
    if (!selectionMenu || !selectionMenu.text) return;
    const { startChar, endChar } = getEffectiveSelectionOffsets();
    const hasOffsets = typeof startChar === 'number' && typeof endChar === 'number';
    setNoteDialog({
      isOpen: true,
      text: selectionMenu.text,
      note: '',
      color: 'gold',
      ...(hasOffsets ? { startChar, endChar } : {}),
    });
    clearSelectionState();
  };


  // Save Note Dialog
  const handleSaveNote = () => {
    if (!noteDialog) return;
    const currentChapterTitle =
      currentBook.ebookChapters?.[currentChapterIndex]?.title ||
      `Chapter ${currentChapterIndex + 1}`;

    if (noteDialog.annotationId) {
      // Edit existing
      const updated = annotations.map((a) =>
        a.id === noteDialog.annotationId
          ? { ...a, note: noteDialog.note.trim(), color: noteDialog.color }
          : a
      );
      const updatedAnn = updated.find((a) => a.id === noteDialog.annotationId);
      saveAnnotations(updated);
      if (updatedAnn) {
        if (updatedAnn.note) syncAnnotationToNoteStorage(updatedAnn);
        else deleteBookNote(updatedAnn.id);
      }
    } else {
      // Create new with note
      const newAnn: EbookAnnotation = {
        id: `ann_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        bookId: currentBook.id,
        chapterIndex: currentChapterIndex,
        chapterTitle: currentChapterTitle,
        text: noteDialog.text,
        color: noteDialog.color,
        note: noteDialog.note.trim(),
        createdAt: Date.now(),
        ...(typeof noteDialog.startChar === 'number' && typeof noteDialog.endChar === 'number'
          ? { startChar: noteDialog.startChar, endChar: noteDialog.endChar }
          : {}),
      };
      saveAnnotations([...annotations, newAnn]);
      if (newAnn.note) syncAnnotationToNoteStorage(newAnn);
    }

    setNoteDialog(null);
    clearSelectionState();
  };

  // Delete Annotation
  const handleDeleteAnnotation = (id: string) => {
    const updated = annotations.filter((a) => a.id !== id);
    saveAnnotations(updated);
    try {
      deleteBookNote(id);
    } catch {
      // ignore
    }
    setActiveHighlightPopup(null);
  };

  // Add Bookmark for current position
  const handleAddBookmark = () => {
    const chapterTitle =
      currentBook.ebookChapters?.[currentChapterIndex]?.title ||
      `Chapter ${currentChapterIndex + 1}`;
    const newBm: EbookBookmark = {
      id: `bm_${Date.now()}`,
      bookId: currentBook.id,
      chapterIndex: currentChapterIndex,
      chapterTitle,
      snippet: `Reading at ${scrollProgress}% progress`,
      scrollPercentage: scrollProgress,
      createdAt: Date.now(),
    };
    saveBookmarks([newBm, ...bookmarks]);
    setActiveSidebarTab('bookmarks');
  };

  // Delete Bookmark
  const handleDeleteBookmark = (id: string) => {
    saveBookmarks(bookmarks.filter((b) => b.id !== id));
  };

  // Mirror an ebook annotation (with a note) into notesStorage so it is
  // visible / editable / deletable from the global BookNotesModal.
  const syncAnnotationToNoteStorage = (ann: EbookAnnotation) => {
    if (!ann.note) return;
    try {
      saveBookNote({
        id: ann.id,
        bookId: ann.bookId,
        bookTitle: currentBook.title,
        author: currentBook.author,
        title: ann.note.split('\n')[0].slice(0, 80) || `Highlight · ${ann.chapterTitle}`,
        content: ann.note,
        color: mapHighlightToNoteColor(ann.color),
        tags: ['ebook-highlight'],
      });
    } catch {
      // storage failures are non-fatal for the reader
    }
  };

  // Smoothly scroll the reader to a given scroll percentage
  const scrollToPercentage = (pct: number) => {
    const el = contentContainerRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    el.scrollTo({ top: Math.max(0, (maxScroll * pct) / 100), behavior: 'smooth' });
  };

  // Jump to a saved bookmark: switch chapter if needed and restore the
  // exact scroll anchor within that chapter.
  const goToEbookBookmark = (bm: EbookBookmark) => {
    setActiveSidebarTab(null);
    if (bm.chapterIndex === currentChapterIndex) {
      scrollToPercentage(bm.scrollPercentage);
    } else {
      targetScrollPercentageRef.current = bm.scrollPercentage;
      isRestoringPositionRef.current = true;
      setCurrentChapterIndex(bm.chapterIndex);
    }
  };

  // Copy selection
  const handleCopySelection = (text: string) => {
    const copyWithFallback = (str: string) => {
      try {
        const ta = document.createElement('textarea');
        ta.value = str;
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        // ignore copy failures
      }
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(() => copyWithFallback(text));
    } else {
      copyWithFallback(text);
    }
    setCopiedState(true);
    setTimeout(() => {
      setCopiedState(false);
      clearSelectionState();
    }, 1200);
  };

  // Export Annotations as Markdown
  const handleExportAnnotations = () => {
    if (annotations.length === 0) return;
    let md = `# Annotations: ${currentBook.title}\n`;
    md += `**Author:** ${currentBook.author}\n`;
    md += `**Exported on:** ${new Date().toLocaleDateString()}\n\n---\n\n`;

    annotations.forEach((ann, idx) => {
      md += `### ${idx + 1}. ${ann.chapterTitle}\n`;
      md += `> "${ann.text}"\n\n`;
      if (ann.note) {
        md += `*Note:* ${ann.note}\n\n`;
      }
      md += `*Highlighted in ${ann.color.toUpperCase()} on ${new Date(ann.createdAt).toLocaleString()}*\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentBook.title.replace(/[^a-zA-Z0-9]/g, '_')}_annotations.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // File upload handling
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const parsedBook = await parseUploadedEpub(file);
      setCurrentBook(parsedBook);
      setCurrentChapterIndex(0);
      if (onUploadNewEpub) {
        onUploadNewEpub(parsedBook);
      }
    } catch (err) {
      console.error('EPUB upload error:', err);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Word count and reading time estimate
  const readingStats = useMemo(() => {
    if (!htmlContent) return { words: 0, minutes: 0 };
    const temp = document.createElement('div');
    temp.innerHTML = htmlContent;
    const text = temp.textContent || '';
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(words / 220));
    return { words, minutes };
  }, [htmlContent]);

  // Enhanced HTML with Highlights, Search Matches, and Image Stabilization
  const processedHtmlContent = useMemo(() => {
    if (!htmlContent) return '';

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');

      // 0. SECURITY: strip active content so injected HTML cannot execute
      // scripts, styles, iframes, or inline event handlers (XSS defense).
      doc.querySelectorAll('script, style, noscript, iframe, object, embed, link, meta')
        .forEach((el) => el.remove());
      doc.querySelectorAll('*').forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
          const name = attr.name.toLowerCase();
          if (name.startsWith('on')) {
            el.removeAttribute(attr.name);
          } else if (
            (name === 'href' || name === 'src') &&
            /^\s*javascript:/i.test(attr.value)
          ) {
            el.removeAttribute(attr.name);
          }
        }
      });

      // 1. Stabilize and sanitize all images to prevent layout glitches and broken displays
      const imgElements = doc.querySelectorAll('img');
      imgElements.forEach((img) => {
        img.classList.add('libriaudio-reader-img');
        img.setAttribute('loading', 'lazy');
        img.setAttribute('decoding', 'async');
        // Prevent layout shift/error flash on broken or missing image URLs
        img.setAttribute(
          'onerror',
          "this.onerror=null; this.classList.add('libriaudio-img-error'); this.style.display='none';"
        );

        // Sanitize inline styles that cause container overflow or layout glitches
        if (img.style.position === 'absolute' || img.style.position === 'fixed') {
          img.style.position = 'static';
        }
        if (img.style.maxWidth) {
          img.style.maxWidth = '100%';
        }
      });

      // Also stabilize svg, image, and figure tags
      const svgElements = doc.querySelectorAll('svg, figure');
      svgElements.forEach((el) => {
        el.classList.add('max-w-full', 'overflow-hidden');
        if (el.tagName.toLowerCase() === 'figure') {
          el.classList.add('my-6', 'mx-auto', 'text-center');
        }
      });

      // 2. Highlights + search marks, injected into clean text nodes
      const currentChapterAnn = annotations.filter(
        (a) => a.chapterIndex === currentChapterIndex
      );
      const hasSearch = searchQuery.trim().length > 1;

      if (currentChapterAnn.length > 0 || hasSearch) {
        // Build the flattened text + node mapping over the current DOM
        const w2 = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
        const parts: { node: Text; start: number; end: number }[] = [];
        let flat = '';
        let n2: Node | null;
        while ((n2 = w2.nextNode())) {
          const t = n2 as Text;
          const v = t.nodeValue || '';
          if (!v) continue;
          const parent = t.parentElement;
          if (
            parent &&
            ['mark', 'script', 'style', 'button', 'noscript'].includes(
              parent.tagName.toLowerCase()
            )
          ) {
            continue;
          }
          parts.push({ node: t, start: flat.length, end: flat.length + v.length });
          flat += v;
        }

        // Collect marks for all annotations in this chapter
        const marks: { s: number; e: number; color: string; id: string }[] = [];
        currentChapterAnn.forEach((ann) => {
          let s = typeof ann.startChar === 'number' ? Math.min(ann.startChar, ann.endChar ?? ann.startChar) : -1;
          let e = typeof ann.endChar === 'number' ? Math.max(ann.startChar ?? ann.endChar, ann.endChar) : -1;

          // If offsets are missing, invalid, or out of bounds, find by text match fallback
          if (s < 0 || e <= s || e > flat.length) {
            if (ann.text && ann.text.trim().length > 0) {
              const snippet = ann.text.trim();
              const found = flat.indexOf(snippet);
              if (found !== -1) {
                s = found;
                e = found + snippet.length;
              }
            }
          }

          if (s >= 0 && e > s && e <= flat.length) {
            marks.push({ s, e, color: ann.color, id: ann.id });
          }
        });

        // Apply highlights into DOM
        if (marks.length > 0) {
          parts.forEach(({ node, start, end }) => {
            const v = node.nodeValue || '';
            const nodeMarks = marks
              .filter((m) => m.s < end && m.e > start)
              .sort((a, b) => a.s - b.s);
            if (nodeMarks.length === 0) return;
            let html = '';
            let pos = 0;
            for (const m of nodeMarks) {
              const ls = Math.max(0, m.s - start);
              const le = Math.min(v.length, m.e - start);
              if (ls < pos || ls >= le) continue;
              html += escapeHtmlText(v.slice(pos, ls));
              html += `<mark class="libriaudio-hl libriaudio-hl-${m.color}" data-annotation-id="${m.id}">${escapeHtmlText(v.slice(ls, le))}</mark>`;
              pos = le;
            }
            html += escapeHtmlText(v.slice(pos));
            if (node.parentNode) {
              const span = doc.createElement('span');
              span.innerHTML = html;
              node.parentNode.replaceChild(span, node);
            }
          });
        }

        // ---- Search matches ----
        if (hasSearch) {
          const w3 = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
          let n3: Node | null;
          while ((n3 = w3.nextNode())) {
            const textNode = n3 as Text;
            const originalText = textNode.nodeValue || '';
            if (!originalText.trim()) continue;
            if (!originalText.toLowerCase().includes(searchQuery.trim().toLowerCase())) continue;
            const escaped = searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const searchRegex = new RegExp(`(${escaped})`, 'gi');
            const html = originalText
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(searchRegex, `<mark class="libriaudio-search-match">$1</mark>`);
            const span = doc.createElement('span');
            span.innerHTML = html;
            textNode.parentNode!.replaceChild(span, textNode);
          }
        }
      }

      return doc.body.innerHTML;
    } catch {
      return htmlContent;
    }
  }, [htmlContent, annotations, currentChapterIndex, searchQuery]);


  // Compute Cross-Chapter Search Results with Context Snippets
  const crossChapterSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const results: {
      chapterIndex: number;
      chapterTitle: string;
      matches: {
        snippet: string;
        before: string;
        match: string;
        after: string;
      }[];
    }[] = [];

    const chapters =
      currentBook.ebookChapters && currentBook.ebookChapters.length > 0
        ? currentBook.ebookChapters
        : [{ id: '1', title: currentBook.title, content: htmlContent || '' }];

    chapters.forEach((ch, chIdx) => {
      // Strip HTML tags for clean text indexing
      const cleanText = (ch.content || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const lowerText = cleanText.toLowerCase();

      const chapterMatches: {
        snippet: string;
        before: string;
        match: string;
        after: string;
      }[] = [];

      let matchPos = lowerText.indexOf(q);
      while (matchPos !== -1 && chapterMatches.length < 15) {
        const start = Math.max(0, matchPos - 35);
        const end = Math.min(cleanText.length, matchPos + q.length + 45);
        const before = (start > 0 ? '...' : '') + cleanText.substring(start, matchPos);
        const match = cleanText.substring(matchPos, matchPos + q.length);
        const after =
          cleanText.substring(matchPos + q.length, end) + (end < cleanText.length ? '...' : '');
        const snippet = `${before}${match}${after}`;

        chapterMatches.push({ snippet, before, match, after });
        matchPos = lowerText.indexOf(q, matchPos + q.length);
      }

      if (chapterMatches.length > 0) {
        results.push({
          chapterIndex: chIdx,
          chapterTitle: ch.title || `Chapter ${chIdx + 1}`,
          matches: chapterMatches,
        });
      }
    });

    return results;
  }, [searchQuery, currentBook.ebookChapters, htmlContent, currentBook.title]);

  const totalSearchMatches = useMemo(() => {
    return crossChapterSearchResults.reduce((sum, res) => sum + res.matches.length, 0);
  }, [crossChapterSearchResults]);

  // Swipe gesture handlers for chapter navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isHoldSelectingRef.current || handleDragRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('.reader-select-handle') || target.closest('#reader-floating-selection-menu')) return;

    if (e.touches.length === 1) {
      swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isHoldSelectingRef.current || handleDragRef.current) {
      swipeStartRef.current = null;
      return;
    }
    if (!swipeStartRef.current || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - swipeStartRef.current.x;
    const dy = e.changedTouches[0].clientY - swipeStartRef.current.y;
    swipeStartRef.current = null;
    if (Math.abs(dx) < 75 || Math.abs(dy) > Math.abs(dx) * 0.7) return;
    const natural = settings.swipeDirection === 'natural';
    const chapters = currentBook.ebookChapters;
    if (!chapters) return;

    if (dx > 0) {
      // Swipe right
      const next = natural ? currentChapterIndex - 1 : currentChapterIndex + 1;
      if (next >= 0 && next < chapters.length) {
        setCurrentChapterIndex(next);
        targetScrollPercentageRef.current = natural ? 100 : 0;
        contentContainerRef.current?.scrollTo({ top: natural ? 999999 : 0 });
      }
    } else {
      // Swipe left
      const next = natural ? currentChapterIndex + 1 : currentChapterIndex - 1;
      if (next >= 0 && next < chapters.length) {
        setCurrentChapterIndex(next);
        targetScrollPercentageRef.current = natural ? 0 : 100;
        contentContainerRef.current?.scrollTo({ top: natural ? 0 : 999999 });
      }
    }
  };

  // Click on Highlight in Text to open mini action card
  const handleContentClick = (e: React.MouseEvent) => {
    if (showSettingsDropdown) {
      setShowSettingsDropdown(false);
      return;
    }
    if (showThreeDotMenu) {
      setShowThreeDotMenu(false);
      return;
    }
    const target = (e.target as HTMLElement).closest('.libriaudio-hl');
    if (target) {
      const id = target.getAttribute('data-annotation-id');
      const ann = annotations.find((a) => a.id === id);
      if (ann) {
        const rect = target.getBoundingClientRect();
        setActiveHighlightPopup({
          annotation: ann,
          x: Math.max(20, Math.min(window.innerWidth - 300, rect.left + rect.width / 2 - 140)),
          y: Math.max(70, rect.bottom + 8),
        });
        return;
      }
    }
    setActiveHighlightPopup(null);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowRight' && currentBook.ebookChapters && currentChapterIndex < currentBook.ebookChapters.length - 1) {
        setCurrentChapterIndex((prev) => prev + 1);
      } else if (e.key === 'ArrowLeft' && currentChapterIndex > 0) {
        setCurrentChapterIndex((prev) => prev - 1);
      } else if (e.key === 'Escape') {
        if (activeSidebarTab) setActiveSidebarTab(null);
        else if (showSettingsDropdown) setShowSettingsDropdown(false);
        else if (selectionMenu) clearSelectionState();
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentBook, currentChapterIndex, activeSidebarTab, showSettingsDropdown, selectionMenu, onClose]);

  if (!isOpen) return null;

  // Theme palettes
  const themeStyles = {
    obsidian: {
      bg: 'bg-[var(--bg)]',
      text: 'text-[var(--text-main)]',
      header: 'bg-[var(--surface-raised)] border-[var(--border-subtle)] shadow-lg text-[var(--text-main)]',
      panel: 'bg-[var(--surface-raised)] border-[var(--border-subtle)] shadow-2xl text-[var(--text-main)]',
      prose: 'prose-invert',
      accent: 'text-[var(--accent)]',
      button: 'hover:bg-[var(--surface-raised)] text-[var(--text-main)] hover:text-[var(--text-main)]',
      badge: 'bg-[var(--surface-raised)] border-[var(--border-subtle)] text-[var(--text-main)]',
      divider: 'border-[var(--border-subtle)]',
    },
    sepia: {
      bg: 'bg-[#F5EFE1]',
      text: 'text-[#382E1E]',
      header: 'bg-[#EAE2CF]/95 border-[var(--border-subtle)] shadow-md text-[#382E1E]',
      panel: 'bg-[#EFE7D5] border-[var(--border-subtle)] shadow-2xl text-[#382E1E]',
      prose: 'prose-amber',
      accent: 'text-[#B45309]',
      button: 'hover:bg-[var(--surface-raised)] text-[#382E1E]/80 hover:text-[#382E1E]',
      badge: 'bg-[var(--surface-raised)] border-[var(--border-subtle)] text-[#382E1E]/70',
      divider: 'border-[var(--border-subtle)]',
    },
    paper: {
      bg: 'bg-[#FFFFFF]',
      text: 'text-[#1E293B]',
      header: 'bg-[#F8FAFC]/95 border-gray-200 shadow-md text-[#1E293B]',
      panel: 'bg-white border-gray-200 shadow-2xl text-[#1E293B]',
      prose: 'prose-slate',
      accent: 'text-[#0F172A]',
      button: 'hover:bg-gray-100 text-gray-700 hover:text-gray-900',
      badge: 'bg-gray-100 border-gray-200 text-gray-700',
      divider: 'border-gray-200',
    },
    midnight: {
      bg: 'bg-[#090D16]',
      text: 'text-[#E0E7FF]',
      header: 'bg-[#0F172A]/95 border-blue-500/20 shadow-lg text-[var(--text-main)]',
      panel: 'bg-[#0F172A] border-blue-500/20 shadow-2xl text-[var(--text-main)]',
      prose: 'prose-invert',
      accent: 'text-[#38BDF8]',
      button: 'hover:bg-[var(--surface-raised)] text-blue-100 hover:text-[var(--text-main)]',
      badge: 'bg-blue-900/30 border-blue-500/20 text-blue-200',
      divider: 'border-blue-500/20',
    },
    oled: {
      bg: 'bg-[#000000]',
      text: 'text-[#D1D5DB]',
      header: 'bg-[var(--bg)] border-[var(--border-subtle)] shadow-none text-[var(--text-main)]',
      panel: 'bg-[var(--bg)] border-[var(--border-subtle)] shadow-2xl text-[var(--text-main)]',
      prose: 'prose-invert',
      accent: 'text-[var(--accent)]',
      button: 'hover:bg-[var(--surface-raised)] text-[var(--text-main)] hover:text-[var(--text-main)]',
      badge: 'bg-[var(--surface-raised)] border-[var(--border-subtle)] text-[var(--text-dim)]',
      divider: 'border-[var(--border-subtle)]',
    },
  };

  const currentTheme = themeStyles[settings.theme] || themeStyles.obsidian;
  const hasChapters = currentBook.ebookChapters && currentBook.ebookChapters.length > 1;

  // Reader's own palette, fully independent of the app theme. These are scoped
  // as CSS variables on the reader root so the app's theme change never
  // disrupts the reading surface or its accent colors.
  const READER_PALETTES: Record<
    string,
    {
      bg: string; surface: string; surfaceRaised: string;
      accent: string; accentHover: string; onAccent: string;
      textMain: string; textDim: string; border: string;
      success: string; warning: string; danger: string;
      overlay: string; scrollbar: string;
    }
  > = {
    obsidian: {
      bg: '#050505', surface: '#0f0f0f', surfaceRaised: '#171717',
      accent: '#C5A059', accentHover: '#d4af65', onAccent: '#0A0A0A',
      textMain: '#ECECEC', textDim: '#8a8a8a', border: 'rgba(255, 255, 255, 0.08)',
      success: '#4ADE80', warning: '#FBBF24', danger: '#F87171',
      overlay: 'rgba(0, 0, 0, 0.55)', scrollbar: 'rgba(255, 255, 255, 0.18)',
    },
    sepia: {
      bg: '#F5EFE1', surface: '#EFE7D5', surfaceRaised: '#E7DCC2',
      accent: '#B45309', accentHover: '#92400e', onAccent: '#FFFFFF',
      textMain: '#382E1E', textDim: '#7A6A50', border: 'rgba(120, 90, 40, 0.22)',
      success: '#047857', warning: '#B45309', danger: '#B91C1C',
      overlay: 'rgba(60, 45, 20, 0.45)', scrollbar: 'rgba(120, 90, 40, 0.25)',
    },
    paper: {
      bg: '#FFFFFF', surface: '#F8FAFC', surfaceRaised: '#EEF2F7',
      accent: '#0F172A', accentHover: '#334155', onAccent: '#FFFFFF',
      textMain: '#1E293B', textDim: '#64748B', border: 'rgba(15, 23, 42, 0.12)',
      success: '#047857', warning: '#B45309', danger: '#B91C1C',
      overlay: 'rgba(15, 23, 42, 0.45)', scrollbar: 'rgba(15, 23, 42, 0.2)',
    },
    midnight: {
      bg: '#090D16', surface: '#0F172A', surfaceRaised: '#1E293B',
      accent: '#38BDF8', accentHover: '#0EA5E9', onAccent: '#062033',
      textMain: '#E0E7FF', textDim: '#94A3B8', border: 'rgba(148, 163, 184, 0.25)',
      success: '#4ADE80', warning: '#FBBF24', danger: '#F87171',
      overlay: 'rgba(9, 13, 22, 0.55)', scrollbar: 'rgba(148, 163, 184, 0.2)',
    },
    oled: {
      bg: '#000000', surface: '#050505', surfaceRaised: '#0b0b0b',
      accent: '#E5A93C', accentHover: '#f5ba4f', onAccent: '#000000',
      textMain: '#D1D5DB', textDim: '#6B7280', border: 'rgba(255, 255, 255, 0.08)',
      success: '#34D399', warning: '#F59E0B', danger: '#FB7185',
      overlay: 'rgba(0, 0, 0, 0.6)', scrollbar: 'rgba(255, 255, 255, 0.15)',
    },
  };

  const readerPalette = READER_PALETTES[settings.theme] || READER_PALETTES.obsidian;
  const customAccent = settings.accentColor && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(settings.accentColor)
    ? settings.accentColor
    : '';
  const readerVars = {
    '--bg': readerPalette.bg,
    '--surface': readerPalette.surface,
    '--surface-raised': readerPalette.surfaceRaised,
    '--accent': customAccent || readerPalette.accent,
    '--accent-hover': customAccent ? lightenHex(customAccent, 0.18) : readerPalette.accentHover,
    '--on-accent': customAccent ? onAccentFor(customAccent) : readerPalette.onAccent,
    '--text-main': readerPalette.textMain,
    '--text-dim': readerPalette.textDim,
    '--border-subtle': readerPalette.border,
    '--success': readerPalette.success,
    '--warning': readerPalette.warning,
    '--danger': readerPalette.danger,
    '--overlay': readerPalette.overlay,
    '--scrollbar': readerPalette.scrollbar,
  } as React.CSSProperties;


  // Font family classes
  const fontFamilies = {
    serif: 'font-serif',
    sans: 'font-sans',
    literary: 'font-serif-display',
    mono: 'font-mono',
  };

  // Column width constraints
  const columnWidths = {
    narrow: 'max-w-xl',
    normal: 'max-w-3xl',
    wide: 'max-w-4xl',
  };

  return (
    <div
      id="ebook-reader-modal"
      className={`fixed inset-0 z-50 flex flex-col animate-in fade-in duration-200 overflow-hidden select-text pt-[max(env(safe-area-inset-top),0px)] ${currentTheme.bg} ${currentTheme.text} ${fontFamilies[settings.fontFamily]}`}
      style={readerVars}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".epub,.txt,.html,.htm"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Top Reading Progress Line */}
      <div className="w-full h-1 bg-[var(--surface-raised)] shrink-0 relative overflow-hidden">
        <div
          className="h-full bg-[var(--accent)] transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Reader Top App Bar */}
      <header
        className={`h-14 border-b flex items-center justify-between px-3 sm:px-6 shrink-0 z-20 backdrop-blur-md ${currentTheme.header}`}
      >
        <div className="flex items-center gap-3 overflow-hidden min-w-0">
          <BookOpen className="w-5 h-5 text-[var(--accent)] shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate font-sans tracking-tight">
              {currentBook.title}
            </h2>
            <div className="flex items-center gap-2 text-[11px] font-sans opacity-70 truncate flex-wrap">
              <span>{currentBook.author}</span>
              {currentBook.ebookChapters && currentBook.ebookChapters.length > 0 && (
                <>
                  <span>•</span>
                  <span className="font-mono text-[var(--accent)]">
                    {currentBook.ebookChapters[currentChapterIndex]?.title ||
                      `Ch. ${currentChapterIndex + 1} / ${currentBook.ebookChapters.length}`}
                  </span>
                </>
              )}
              {isStoredOffline && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span
                    id="badge-reader-stored-offline"
                    className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-medium"
                    title="This ebook is stored on your device for instant offline reading"
                  >
                    <HardDrive className="w-3 h-3 text-emerald-400" />
                    <span>Stored on Device</span>
                  </span>
                </>
              )}
              {/* Session timer removed */}
            </div>
          </div>
        </div>

        {/* Reader Action Toolbar: Three-Dot Menu & Close */}
        <div className="flex items-center gap-2 shrink-0 font-sans relative">
          <div className="relative">
            <button
              id="btn-reader-three-dot"
              onClick={() => {
                setShowThreeDotMenu(!showThreeDotMenu);
              }}
              className={`p-2 rounded-xl border transition-all ${
                showThreeDotMenu
                  ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)]'
                  : `border-transparent ${currentTheme.button}`
              }`}
              title="More Reader Features"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {/* Three-Dot Dropdown Menu */}
            {showThreeDotMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 border-b border-[var(--border-subtle)] mb-1">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--accent)]">Reader Tools</p>
                </div>
                <button
                  onClick={() => {
                    setShowThreeDotMenu(false);
                    setActiveSidebarTab('search');
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs flex items-center gap-2.5 hover:bg-[var(--surface-raised)] transition-colors text-[var(--text-main)]"
                >
                  <Search className="w-4 h-4 text-[var(--accent)]" />
                  <span>Search in Book</span>
                </button>
                <div className="my-1 border-t border-[var(--border-subtle)]" />
                {annotations.length > 0 && (
                  <button
                    onClick={() => {
                      setShowThreeDotMenu(false);
                      handleExportAnnotations();
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs flex items-center gap-2.5 hover:bg-[var(--surface-raised)] transition-colors text-[var(--text-main)]"
                  >
                    <Download className="w-4 h-4 text-[var(--accent)]" />
                    <span>Export Highlights ({annotations.length})</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowThreeDotMenu(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs flex items-center gap-2.5 hover:bg-[var(--surface-raised)] transition-colors text-[var(--text-main)]"
                >
                  <Upload className="w-4 h-4 text-[var(--accent)]" />
                  <span>Upload EPUB File</span>
                </button>
              </div>
            )}
          </div>

          {/* Close Reader */}
          <button
            id="btn-reader-close"
            onClick={onClose}
            className={`p-2 rounded-xl ml-1 transition-colors ${currentTheme.button}`}
            title="Close Ebook Reader"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Body: Content & Slide-Out Sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Text Manuscript View */}
        <div
          ref={contentContainerRef}
          id="reader-content-scroll"
          onScroll={handleScroll}
          onClick={handleContentClick}
          onPointerDown={handleReaderPointerDown}
          onPointerMove={handleReaderPointerMove}
          onPointerUp={handleReaderPointerUp}
          onPointerCancel={handleReaderPointerCancel}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-black/20 pb-32 transition-all relative"
        >
          <div
            ref={contentWrapperRef}
            className={`${columnWidths[settings.columnWidth]} mx-auto px-5 py-8 md:px-12 md:py-12 relative`}
          >
            {isLoading ? (
              <div className="space-y-6 py-6 animate-pulse">
                <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
                  <div className="h-4 w-48 bg-[var(--surface-raised)] rounded" />
                  <div className="h-3 w-24 bg-[var(--surface-raised)] rounded" />
                </div>
                <div className="space-y-4">
                  <div className="h-6 w-3/4 bg-[var(--surface-raised)] rounded" />
                  <div className="h-4 w-full bg-[var(--surface-raised)] rounded" />
                  <div className="h-4 w-full bg-[var(--surface-raised)] rounded" />
                  <div className="h-4 w-5/6 bg-[var(--surface-raised)] rounded" />
                  <div className="h-4 w-full bg-[var(--surface-raised)] rounded" />
                  <div className="h-4 w-4/5 bg-[var(--surface-raised)] rounded" />
                  <div className="h-6 w-1/2 bg-[var(--surface-raised)] rounded mt-8" />
                  <div className="h-4 w-full bg-[var(--surface-raised)] rounded" />
                  <div className="h-4 w-full bg-[var(--surface-raised)] rounded" />
                  <div className="h-4 w-3/4 bg-[var(--surface-raised)] rounded" />
                </div>
                <div className="flex items-center justify-center gap-2 py-4 text-[var(--text-dim)] text-xs font-sans">
                  <div className="w-3.5 h-3.5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                  <span>Loading ebook from Project Gutenberg...</span>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-20 opacity-90 max-w-md mx-auto space-y-5 font-sans">
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center mx-auto">
                  <BookOpen className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-red-400">Failed to Load eBook</p>
                  <p className="text-xs opacity-65 leading-relaxed text-[var(--text-dim)]">
                    {error}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setError(null);
                      setIsLoading(true);
                      // Trigger re-fetch by toggling a retry counter
                      setCurrentChapterIndex((prev) => prev);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-semibold text-xs inline-flex items-center gap-2 transition-all shadow-lg cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Retry Connection</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="px-5 py-2.5 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] text-[var(--text-main)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] font-semibold text-xs inline-flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{isUploading ? 'Parsing...' : 'Upload EPUB'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Chapter Title Header inside text */}
                <div className="mb-8 pb-4 border-b border-[var(--border-subtle)] flex items-center justify-between font-sans text-xs opacity-60">
                  <span>
                    {currentBook.ebookChapters?.[currentChapterIndex]?.title || currentBook.title}
                  </span>
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span>{readingStats.words} words</span>
                    <span>•</span>
                    <span>~{readingStats.minutes} min read</span>
                    {sessionReadingSeconds > 5 && scrollProgress > 0 && (
                      <>
                        <span>•</span>
                        <span>{Math.round((readingStats.words * (scrollProgress / 100)) / (sessionReadingSeconds / 60))} wpm</span>
                      </>
                    )}
                  </div>
                </div>

                <article
                  ref={articleRef}
                  className={`prose ${currentTheme.prose} ${settings.textAlign === 'justify' ? 'text-justify' : 'text-left'} max-w-full leading-relaxed transition-all`}
                  style={{
                    fontSize: `${settings.fontSize}px`,
                    lineHeight: settings.lineHeight,
                  }}
                  dangerouslySetInnerHTML={{ __html: processedHtmlContent }}
                />

                {/* Chapter Navigation Footer at bottom of chapter text */}
                {currentBook.ebookChapters && currentBook.ebookChapters.length > 1 && (
                  <div className="mt-16 pt-8 border-t border-[var(--border-subtle)] font-sans">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      {currentChapterIndex > 0 ? (
                        <button
                          onClick={() => {
                            setCurrentChapterIndex(currentChapterIndex - 1);
                            targetScrollPercentageRef.current = 0;
                            contentContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="w-full sm:w-auto px-4 py-3 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-xs flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4 text-[var(--accent)]" />
                          <div className="text-left">
                            <span className="text-[10px] opacity-60 block uppercase">Previous Chapter</span>
                            <span className="font-semibold truncate max-w-[200px] block">
                              {currentBook.ebookChapters[currentChapterIndex - 1]?.title}
                            </span>
                          </div>
                        </button>
                      ) : (
                        <div />
                      )}

                      {currentChapterIndex < currentBook.ebookChapters.length - 1 ? (
                        <button
                          onClick={() => {
                            setCurrentChapterIndex(currentChapterIndex + 1);
                            targetScrollPercentageRef.current = 0;
                            contentContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="w-full sm:w-auto px-4 py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-semibold text-xs flex items-center justify-between gap-2 transition-colors shadow-lg cursor-pointer ml-auto"
                        >
                          <div className="text-right">
                            <span className="text-[10px] opacity-80 block uppercase">Next Chapter</span>
                            <span className="truncate max-w-[200px] block">
                              {currentBook.ebookChapters[currentChapterIndex + 1]?.title}
                            </span>
                          </div>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setBookStatus(currentBook.id, 'read');
                            saveEbookPosition(currentBook.id, currentChapterIndex, 100, currentBook.ebookChapters?.length || 1);
                          }}
                          className="w-full sm:w-auto px-5 py-3 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer ml-auto"
                        >
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                          <span>Finished Book</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Slide-out Multi-Tab Sidebar Panel */}
        {activeSidebarTab && (
          <aside
            id="reader-sidebar-drawer"
            className={`w-full sm:w-84 md:w-96 border-l z-30 flex flex-col font-sans animate-in slide-in-from-right-3 duration-200 ${currentTheme.panel}`}
          >
            {/* Sidebar Header */}
            <div className={`p-4 border-b flex items-center justify-between ${currentTheme.divider}`}>
              <div className="flex items-center gap-2">
                {activeSidebarTab === 'chapters' && <List className="w-4 h-4 text-[var(--accent)]" />}
                {activeSidebarTab === 'highlights' && <Highlighter className="w-4 h-4 text-[var(--accent)]" />}
                {activeSidebarTab === 'search' && <Search className="w-4 h-4 text-[var(--accent)]" />}
                {activeSidebarTab === 'bookmarks' && <BookmarkIcon className="w-4 h-4 text-[var(--accent)]" />}
                <h3 className="text-xs uppercase font-bold tracking-wider opacity-90">
                  {activeSidebarTab === 'chapters' && 'Table of Contents'}
                  {activeSidebarTab === 'highlights' && `Highlights & Notes (${annotations.length})`}
                  {activeSidebarTab === 'search' && 'Search in Book'}
                  {activeSidebarTab === 'bookmarks' && `Bookmarks (${bookmarks.length})`}
                </h3>
              </div>
              <div className="flex items-center gap-1">
                {activeSidebarTab === 'highlights' && annotations.length > 0 && (
                  <button
                    onClick={handleExportAnnotations}
                    className="p-1.5 rounded-lg hover:bg-[var(--surface-raised)] text-xs text-[var(--accent)] flex items-center gap-1 font-medium transition-colors"
                    title="Export Annotations as Markdown"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Export</span>
                  </button>
                )}
                <button
                  onClick={() => setActiveSidebarTab(null)}
                  className="p-1 rounded-lg hover:bg-[var(--surface-raised)] opacity-60 hover:opacity-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sidebar Content per Tab */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
              {/* 1. Chapters Tab */}
              {activeSidebarTab === 'chapters' && (
                <div className="space-y-1.5">
                  {currentBook.ebookChapters && currentBook.ebookChapters.length > 0 ? (
                    currentBook.ebookChapters.map((ch, idx) => (
                      <button
                        key={ch.id || idx}
                        onClick={() => {
                          setCurrentChapterIndex(idx);
                          setActiveSidebarTab(null);
                        }}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                          idx === currentChapterIndex
                            ? 'bg-[var(--accent)] text-[var(--on-accent)] font-semibold shadow-md'
                            : `${currentTheme.button} opacity-85`
                        }`}
                      >
                        <span className="truncate pr-2">{ch.title}</span>
                        <span className="text-[10px] opacity-60 font-mono shrink-0">#{idx + 1}</span>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-10 opacity-60 text-xs">
                      Single chapter manuscript.
                    </div>
                  )}
                </div>
              )}

              {/* 2. Highlights & Notes Tab */}
              {activeSidebarTab === 'highlights' && (
                <div className="space-y-3">
                  {annotations.length === 0 ? (
                    <div className="text-center py-12 opacity-60 space-y-2">
                      <Highlighter className="w-8 h-8 mx-auto text-[var(--accent)] mb-2" />
                      <p className="text-xs font-medium">No highlights or notes yet</p>
                      <p className="text-[11px] leading-relaxed max-w-xs mx-auto opacity-70">
                        Select any text in the book to highlight it or attach a reflection note.
                      </p>
                    </div>
                  ) : (
                    annotations.map((ann) => {
                      const colorDef = HIGHLIGHT_COLORS.find((c) => c.id === ann.color);
                      return (
                        <div
                          key={ann.id}
                          className={`p-3.5 rounded-xl border ${currentTheme.badge} space-y-2 hover:border-[var(--accent)] transition-colors`}
                        >
                          <div className="flex items-center justify-between text-[10px] opacity-65">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${colorDef?.dot || 'bg-amber-400'}`} />
                              <span className="font-medium truncate max-w-[140px]">{ann.chapterTitle}</span>
                            </div>
                            <span>{new Date(ann.createdAt).toLocaleDateString()}</span>
                          </div>

                          <blockquote className="text-xs italic border-l-2 pl-2.5 border-[var(--accent)] line-clamp-3 opacity-90">
                            "{ann.text}"
                          </blockquote>

                          {ann.note && (
                            <div className="bg-[var(--surface-raised)] p-2 rounded-lg text-xs flex items-start gap-1.5 text-[var(--accent)]">
                              <StickyNote className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <p className="opacity-95 leading-relaxed">{ann.note}</p>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)] text-[11px]">
                            <button
                              onClick={() => {
                                setCurrentChapterIndex(ann.chapterIndex);
                                setActiveSidebarTab(null);
                              }}
                              className="text-[var(--accent)] hover:underline font-medium flex items-center gap-1"
                            >
                              <span>Jump to text</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  setNoteDialog({
                                    isOpen: true,
                                    annotationId: ann.id,
                                    text: ann.text,
                                    note: ann.note || '',
                                    color: ann.color,
                                    startChar: ann.startChar,
                                    endChar: ann.endChar,
                                  })
                                }
                                className="opacity-70 hover:opacity-100 hover:text-[var(--accent)]"
                                title="Edit Note"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteAnnotation(ann.id)}
                                className="opacity-70 hover:opacity-100 hover:text-red-400"
                                title="Delete Highlight"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* 3. Search in Book Tab */}
              {activeSidebarTab === 'search' && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search text in manuscript..."
                      className="w-full pl-9 pr-4 py-2 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-xs focus:outline-none focus:border-[var(--accent)]"
                      autoFocus
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {searchQuery.trim().length > 1 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs pb-2 border-b border-[var(--border-subtle)]">
                        <span className="text-[var(--accent)] font-medium">
                          {totalSearchMatches} {totalSearchMatches === 1 ? 'match' : 'matches'} found
                        </span>
                        <span className="opacity-60 text-[11px]">
                          across {crossChapterSearchResults.length} {crossChapterSearchResults.length === 1 ? 'chapter' : 'chapters'}
                        </span>
                      </div>

                      {crossChapterSearchResults.length === 0 ? (
                        <div className="text-center py-10 opacity-60 text-xs space-y-1">
                          <p className="font-semibold text-[var(--text-main)]">No matches found</p>
                          <p className="text-[11px] opacity-60">Try searching for a different word or phrase.</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                          {crossChapterSearchResults.map((chRes) => (
                            <div
                              key={chRes.chapterIndex}
                              className="p-3 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] space-y-2"
                            >
                              <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--accent)]">
                                <span className="truncate pr-2">{chRes.chapterTitle}</span>
                                <span className="px-1.5 py-0.5 rounded bg-[var(--accent-dim)] text-[10px] font-mono shrink-0">
                                  {chRes.matches.length}
                                </span>
                              </div>

                              <div className="space-y-1.5">
                                {chRes.matches.map((m, mIdx) => (
                                  <button
                                    key={mIdx}
                                    onClick={() => {
                                      setCurrentChapterIndex(chRes.chapterIndex);
                                      setActiveSidebarTab(null);
                                      setTimeout(() => {
                                        const matchEl = document.querySelector('.libriaudio-search-match');
                                        if (matchEl) {
                                          matchEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }
                                      }, 200);
                                    }}
                                    className="w-full text-left p-2 rounded-lg bg-black/20 hover:bg-[var(--accent-dim)] border border-transparent hover:border-[var(--accent)] text-[11px] leading-relaxed transition-all block cursor-pointer"
                                  >
                                    <span className="opacity-70">{m.before}</span>
                                    <mark className="bg-[var(--accent)] text-[var(--on-accent)] font-semibold px-1 rounded-sm mx-0.5">
                                      {m.match}
                                    </mark>
                                    <span className="opacity-70">{m.after}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-10 opacity-50 text-xs">
                      Type keywords or phrases above to search instantly across all chapters.
                    </div>
                  )}
                </div>
              )}

              {/* 4. Bookmarks Tab */}
              {activeSidebarTab === 'bookmarks' && (
                <div className="space-y-3">
                  <button
                    onClick={handleAddBookmark}
                    className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-xs flex items-center justify-center gap-2 hover:bg-[var(--accent-hover)] transition-colors"
                  >
                    <BookmarkIcon className="w-4 h-4" />
                    <span>Bookmark Current Position ({scrollProgress}%)</span>
                  </button>

                  {bookmarks.length === 0 ? (
                    <div className="text-center py-10 opacity-60 text-xs">
                      No bookmarks saved yet for this book.
                    </div>
                  ) : (
                    bookmarks.map((bm) => (
                      <div
                        key={bm.id}
                        className={`p-3 rounded-xl border ${currentTheme.badge} flex items-center justify-between text-xs`}
                      >
                        <div
                          onClick={() => goToEbookBookmark(bm)}
                          className="cursor-pointer space-y-0.5 flex-1 pr-2"
                        >
                          <p className="font-semibold text-[var(--accent)] truncate">{bm.chapterTitle}</p>
                          <p className="text-[10px] opacity-60">
                            {bm.snippet} • {new Date(bm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteBookmark(bm.id)}
                          className="p-1.5 text-xs opacity-60 hover:opacity-100 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Selection Handles */}
      {selectionMenu && selectionMenu.visible && selectionMenu.handleStart && selectionMenu.handleEnd && (
        <>
          <div
            className={`reader-select-handle reader-select-handle-start ${activeDraggingHandle === 'start' ? 'dragging' : ''}`}
            style={{ left: `${selectionMenu.handleStart.x}px`, top: `${selectionMenu.handleStart.y}px` }}
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              onHandleDragStart('start', e.clientX, e.clientY, e);
            }}
            onTouchStart={(e) => {
              if (e.touches[0]) onHandleDragStart('start', e.touches[0].clientX, e.touches[0].clientY, e);
            }}
          />
          <div
            className={`reader-select-handle reader-select-handle-end ${activeDraggingHandle === 'end' ? 'dragging' : ''}`}
            style={{ left: `${selectionMenu.handleEnd.x}px`, top: `${selectionMenu.handleEnd.y}px` }}
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              onHandleDragStart('end', e.clientX, e.clientY, e);
            }}
            onTouchStart={(e) => {
              if (e.touches[0]) onHandleDragStart('end', e.touches[0].clientX, e.touches[0].clientY, e);
            }}
          />
        </>
      )}

      {/* Floating Selection Toolbar */}
      {selectionMenu && selectionMenu.visible && (
        <div
          id="reader-floating-selection-menu"
          className="fixed z-[80] flex items-center gap-1 bg-[var(--surface)] backdrop-blur-md border border-[var(--border-subtle)] px-2 py-1.5 rounded-full shadow-2xl animate-in zoom-in-95 duration-100 text-[var(--text-main)] font-sans text-xs"
          style={{ top: `${selectionMenu.y}px`, left: `${selectionMenu.x}px` }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {/* Highlight Color Pickers */}
          <div className="flex items-center gap-1 px-1 border-r border-[var(--border-subtle)]">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.id}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={() => createHighlight(c.id)}
                className={`w-5 h-5 rounded-full ${c.dot} hover:scale-110 active:scale-95 transition-transform cursor-pointer`}
                title={`Highlight in ${c.name}`}
              />
            ))}
          </div>

          {/* Add Note Button */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={openNoteFromSelection}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-raised)] flex items-center gap-1 text-[var(--accent)] font-medium cursor-pointer"
            title="Attach Note"
          >
            <StickyNote className="w-3.5 h-3.5" />
            <span className="text-[11px]">Note</span>
          </button>

          {/* Bookmark Selected Text */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={bookmarkFromSelection}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-raised)] flex items-center gap-1 text-[var(--accent)] font-medium cursor-pointer"
            title="Bookmark selected text"
          >
            <BookmarkIcon className="w-3.5 h-3.5" />
            <span className="text-[11px]">Mark</span>
          </button>

          {/* Dictionary — opens WordWeb / system dictionary app */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={() => handleDictionaryLookup(selectionMenu.text)}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-raised)] flex items-center gap-1 font-medium cursor-pointer"
            title="Look up in Dictionary App"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="text-[11px]">Dictionary</span>
          </button>

          {/* Copy Text */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={() => handleCopySelection(selectionMenu.text)}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-raised)] flex items-center gap-1 cursor-pointer"
            title="Copy Text"
          >
            {copiedState ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}


      {/* Popover Mini Card when clicking an existing highlight in text */}
      {activeHighlightPopup && (
        <div
          id="reader-active-highlight-card"
          className="fixed z-50 p-3.5 rounded-2xl bg-[var(--surface-raised)] backdrop-blur-md border border-[var(--border-subtle)] shadow-2xl font-sans text-xs w-72 text-[var(--text-main)] animate-in zoom-in-95 duration-100"
          style={{ top: `${activeHighlightPopup.y}px`, left: `${activeHighlightPopup.x}px` }}
        >
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)] mb-2">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  HIGHLIGHT_COLORS.find((c) => c.id === activeHighlightPopup.annotation.color)?.dot || 'bg-amber-400'
                }`}
              />
              <span className="font-bold text-[11px] uppercase tracking-wider text-[var(--accent)]">
                {activeHighlightPopup.annotation.color} Highlight
              </span>
            </div>
            <button
              onClick={() => setActiveHighlightPopup(null)}
              className="p-1 opacity-50 hover:opacity-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <blockquote className="italic opacity-80 text-[11px] line-clamp-2 mb-2 pl-2 border-l-2 border-[var(--accent)]">
            "{activeHighlightPopup.annotation.text}"
          </blockquote>

          {activeHighlightPopup.annotation.note ? (
            <div className="bg-[var(--surface-raised)] p-2 rounded-xl text-[11px] mb-3 text-[var(--accent)]">
              <span className="font-semibold block text-[10px] uppercase opacity-70 mb-0.5">Note</span>
              <p className="opacity-95">{activeHighlightPopup.annotation.note}</p>
            </div>
          ) : (
            <p className="text-[10px] opacity-50 mb-3">No note attached to this highlight.</p>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)] text-[11px]">
            <button
              onClick={() => {
                const ann = activeHighlightPopup.annotation;
                setActiveHighlightPopup(null);
                setNoteDialog({
                  isOpen: true,
                  annotationId: ann.id,
                  text: ann.text,
                  note: ann.note || '',
                  color: ann.color,
                  startChar: ann.startChar,
                  endChar: ann.endChar,
                });
              }}
              className="text-[var(--accent)] font-medium hover:underline"
            >
              {activeHighlightPopup.annotation.note ? 'Edit Note' : '+ Add Note'}
            </button>
            <button
              onClick={() => handleDeleteAnnotation(activeHighlightPopup.annotation.id)}
              className="text-red-400 hover:text-red-300 font-medium flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* Note Creator / Editor Modal Dialog */}
      {noteDialog && noteDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-2xl max-w-md w-full p-5 shadow-2xl font-sans text-[var(--text-main)] space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-[var(--accent)]" />
                <h3 className="text-sm font-bold">
                  {noteDialog.annotationId ? 'Edit Annotation Note' : 'Add Note to Selection'}
                </h3>
              </div>
              <button
                onClick={() => setNoteDialog(null)}
                className="p-1 opacity-60 hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <blockquote className="text-xs italic p-3 rounded-xl bg-[var(--surface-raised)] border-l-2 border-[var(--accent)] opacity-80 max-h-24 overflow-y-auto">
              "{noteDialog.text}"
            </blockquote>

            <div className="space-y-2">
              <label className="text-xs font-semibold opacity-70 block">Your Note & Reflections</label>
              <textarea
                value={noteDialog.note}
                onChange={(e) =>
                  setNoteDialog((prev) => (prev ? { ...prev, note: e.target.value } : null))
                }
                placeholder="Write your thoughts, references, or reflections here..."
                rows={4}
                className="w-full p-3 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-xs focus:outline-none focus:border-[var(--accent)] resize-none"
                autoFocus
              />
            </div>

            {/* Color selector */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs opacity-60">Color:</span>
                <div className="flex gap-1.5">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() =>
                        setNoteDialog((prev) => (prev ? { ...prev, color: c.id } : null))
                      }
                      className={`w-6 h-6 rounded-full ${c.dot} transition-transform ${
                        noteDialog.color === c.id ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setNoteDialog(null)}
                  className="px-3 py-2 rounded-xl text-xs opacity-70 hover:opacity-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNote}
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] font-semibold text-xs transition-colors"
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tap-outside backdrop for Typography & Style panel */}
      {showSettingsDropdown && (
        <div
          className="fixed inset-0 z-[60] bg-transparent"
          aria-hidden
          style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('#reader-floating-selection-menu')) return;
            setShowSettingsDropdown(false);
          }}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('#reader-floating-selection-menu')) return;
            setShowSettingsDropdown(false);
          }}
        />
      )}

      {/* Reader Typography & Appearance Floating Settings Panel */}
      {showSettingsDropdown && (
        <div
          id="reader-settings-panel"
          className={`fixed top-20 right-4 p-5 rounded-2xl border z-[70] w-80 shadow-2xl font-sans animate-in slide-in-from-top-2 duration-150 ${currentTheme.panel}`}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] mb-4">
            <h3 className="text-xs uppercase font-bold text-[var(--accent)] tracking-wider">
              Reader Typography & Style
            </h3>
            <button
              onClick={() => setShowSettingsDropdown(false)}
              className="p-1 opacity-50 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4 text-xs">
            {/* Theme Selector */}
            <div>
              <span className="text-[11px] font-medium opacity-70 mb-2 block uppercase tracking-wider">Theme Palette</span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'obsidian', label: 'Obsidian', bg: 'bg-[var(--bg)]', text: 'text-[var(--text-main)]' },
                  { id: 'sepia', label: 'Sepia', bg: 'bg-[#F5EFE1]', text: 'text-[#382E1E]' },
                  { id: 'paper', label: 'Paper', bg: 'bg-white', text: 'text-gray-900' },
                  { id: 'midnight', label: 'Midnight', bg: 'bg-[#090D16]', text: 'text-blue-100' },
                  { id: 'oled', label: 'OLED', bg: 'bg-black', text: 'text-[var(--text-main)]' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => updateSettings({ theme: t.id as any })}
                    className={`py-1.5 px-2 rounded-xl border text-center font-medium transition-all ${t.bg} ${t.text} ${
                      settings.theme === t.id
                        ? 'border-[var(--accent)] ring-1 ring-[var(--accent)] shadow-md'
                        : 'border-[var(--border-subtle)] opacity-70 hover:opacity-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Family Selector */}
            <div>
              <span className="text-[11px] font-medium opacity-70 mb-2 block uppercase tracking-wider">Typeface</span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'serif', label: 'Merriweather Serif', font: 'font-serif' },
                  { id: 'sans', label: 'Plus Jakarta Sans', font: 'font-sans' },
                  { id: 'literary', label: 'Playfair Display', font: 'font-serif-display' },
                  { id: 'mono', label: 'JetBrains Mono', font: 'font-mono' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => updateSettings({ fontFamily: f.id as any })}
                    className={`py-1.5 px-2 rounded-xl border text-xs text-center transition-all ${f.font} ${
                      settings.fontFamily === f.id
                        ? 'bg-[var(--accent)] text-[var(--on-accent)] font-semibold border-[var(--accent)]'
                        : 'bg-[var(--surface-raised)] border-[var(--border-subtle)] opacity-80 hover:opacity-100'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size Slider & A- / A+ */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium opacity-70 uppercase tracking-wider">Text Size</span>
                <span className="font-mono text-xs text-[var(--accent)]">{settings.fontSize}px</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateSettings({ fontSize: Math.max(12, settings.fontSize - 1) })}
                  className="w-7 h-7 rounded-lg border border-[var(--border-subtle)] flex items-center justify-center font-bold"
                >
                  A-
                </button>
                <input
                  type="range"
                  min="12"
                  max="32"
                  value={settings.fontSize}
                  onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value, 10) })}
                  className="flex-1 accent-[var(--accent)]"
                />
                <button
                  onClick={() => updateSettings({ fontSize: Math.min(32, settings.fontSize + 1) })}
                  className="w-7 h-7 rounded-lg border border-[var(--border-subtle)] flex items-center justify-center font-bold"
                >
                  A+
                </button>
              </div>
            </div>

            {/* Line Height & Alignment */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-[10px] font-medium opacity-70 mb-1.5 block uppercase tracking-wider">Line Spacing</span>
                <div className="flex gap-1">
                  {[
                    { val: 1.45, label: '1.4x' },
                    { val: 1.75, label: '1.7x' },
                    { val: 2.1, label: '2.1x' },
                  ].map((l) => (
                    <button
                      key={l.val}
                      onClick={() => updateSettings({ lineHeight: l.val })}
                      className={`flex-1 py-1 rounded-lg border text-[11px] font-mono transition-all ${
                        settings.lineHeight === l.val
                          ? 'bg-[var(--accent)] text-[var(--on-accent)] font-semibold border-[var(--accent)]'
                          : 'bg-[var(--surface-raised)] border-[var(--border-subtle)] opacity-70'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-medium opacity-70 mb-1.5 block uppercase tracking-wider">Alignment</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => updateSettings({ textAlign: 'left' })}
                    className={`flex-1 py-1 rounded-lg border flex items-center justify-center transition-all ${
                      settings.textAlign === 'left'
                        ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)]'
                        : 'bg-[var(--surface-raised)] border-[var(--border-subtle)] opacity-70'
                    }`}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => updateSettings({ textAlign: 'justify' })}
                    className={`flex-1 py-1 rounded-lg border flex items-center justify-center transition-all ${
                      settings.textAlign === 'justify'
                        ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)]'
                        : 'bg-[var(--surface-raised)] border-[var(--border-subtle)] opacity-70'
                    }`}
                  >
                    <AlignJustify className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Swipe / Scroll Chapter Navigation Option */}
            <div className="pt-2 border-t border-[var(--border-subtle)]">
              <span className="text-[10px] font-medium opacity-70 mb-1.5 block uppercase tracking-wider">Swipe Direction</span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'natural', label: 'Left / Right (Natural)' },
                  { id: 'reversed', label: 'Right / Left (Inverted)' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => updateSettings({ swipeDirection: s.id as any })}
                    className={`py-1.5 px-2 rounded-xl border text-[11px] text-center transition-all ${
                      settings.swipeDirection === s.id
                        ? 'bg-[var(--accent)] text-[var(--on-accent)] font-semibold border-[var(--accent)]'
                        : 'bg-[var(--surface-raised)] border-[var(--border-subtle)] opacity-70 hover:opacity-100'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent Color Picker */}
            <div>
              <span className="text-[11px] font-medium opacity-70 mb-2 block uppercase tracking-wider">Accent Color</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.accentColor || readerPalette.accent}
                  onChange={(e) => updateSettings({ accentColor: e.target.value })}
                  className="w-9 h-9 rounded-lg border border-[var(--border-subtle)] bg-transparent cursor-pointer p-0.5"
                  title="Choose accent color"
                />
                <div className="flex-1 grid grid-cols-5 gap-1.5">
                  {[
                    '#C5A059', '#D97706', '#16A34A', '#0EA5E9', '#7C3AED',
                  ].map((sw) => {
                    const isActive = settings.accentColor
                      ? settings.accentColor.toLowerCase() === sw.toLowerCase()
                      : readerPalette.accent.toLowerCase() === sw.toLowerCase();
                    return (
                      <button
                        key={sw}
                        onClick={() => updateSettings({ accentColor: sw })}
                        className={`w-full aspect-square rounded-lg border transition-all ${
                          isActive ? 'ring-2 ring-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border-subtle)] hover:scale-105'
                        }`}
                        style={{ backgroundColor: sw }}
                        title={sw}
                      />
                    );
                  })}
                </div>
              </div>
              <button
                onClick={() => updateSettings({ accentColor: '' })}
                className={`mt-2 w-full py-1.5 rounded-xl border text-[11px] text-center transition-all ${
                  settings.accentColor
                    ? 'bg-[var(--surface-raised)] border-[var(--border-subtle)] opacity-70 hover:opacity-100'
                    : 'bg-[var(--accent)] text-[var(--on-accent)] font-semibold border-[var(--accent)]'
                }`}
              >
                Use theme default
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Bottom Essentials & Chapter Navigation Bar */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[var(--surface-raised)] backdrop-blur-md px-3.5 py-2 rounded-2xl border border-[var(--border-subtle)] shadow-2xl text-[var(--text-main)] font-sans text-xs z-30 max-w-[95vw] overflow-x-auto scrollbar-none">
        {/* Table of Contents */}
        <button
          id="btn-reader-bottom-toc"
          onClick={() => setActiveSidebarTab(activeSidebarTab === 'chapters' ? null : 'chapters')}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            activeSidebarTab === 'chapters'
              ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)]'
              : 'border-transparent hover:bg-[var(--surface-raised)] text-[var(--text-main)]'
          }`}
          title="Table of Contents"
        >
          <List className="w-4 h-4" />
        </button>

        {/* Highlights & Notes */}
        <button
          id="btn-reader-bottom-highlights"
          onClick={() => setActiveSidebarTab(activeSidebarTab === 'highlights' ? null : 'highlights')}
          className={`p-2 rounded-xl border relative transition-all cursor-pointer ${
            activeSidebarTab === 'highlights'
              ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)]'
              : 'border-transparent hover:bg-[var(--surface-raised)] text-[var(--text-main)]'
          }`}
          title="Highlights & Notes"
        >
          <Highlighter className="w-4 h-4" />
          {annotations.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] font-bold text-[9px] flex items-center justify-center">
              {annotations.length > 99 ? '99+' : annotations.length}
            </span>
          )}
        </button>

        {/* Bookmark Current Position */}
        <button
          id="btn-reader-bottom-bookmark"
          onClick={handleAddBookmark}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            activeSidebarTab === 'bookmarks'
              ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)]'
              : 'border-transparent hover:bg-[var(--surface-raised)] text-[var(--text-main)]'
          }`}
          title="Bookmark Current Page"
        >
          <BookmarkIcon className="w-4 h-4" />
        </button>

        {/* Typography & Settings */}
        <button
          id="btn-reader-bottom-settings"
          onClick={() => {
            setShowSettingsDropdown(!showSettingsDropdown);
          }}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            showSettingsDropdown
              ? 'bg-[var(--surface-raised)] border-[var(--border-subtle)]'
              : 'border-transparent hover:bg-[var(--surface-raised)] text-[var(--text-main)]'
          }`}
          title="Reader Display Settings"
        >
          <Settings2 className="w-4 h-4" />
        </button>

        {/* Audiobook Playback Controls while reading */}
        {onTogglePlayPause && (
          <>
            <div className="h-4 w-px bg-[var(--surface-raised)] mx-0.5" />
            <button
              onClick={onRewind15}
              className="p-1.5 rounded-full hover:bg-[var(--surface-raised)] text-[var(--text-main)] transition-colors cursor-pointer"
              title="Rewind 15s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onTogglePlayPause}
              className="p-2 rounded-full bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] transition-all shadow-md active:scale-95 cursor-pointer"
              title={playerState?.isPlaying ? 'Pause Audiobook' : 'Play Audiobook'}
            >
              {playerState?.isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
            <button
              onClick={onForward30}
              className="p-1.5 rounded-full hover:bg-[var(--surface-raised)] text-[var(--text-main)] transition-colors cursor-pointer"
              title="Forward 30s"
            >
              <RotateCcw className="w-4 h-4 scale-x-[-1]" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
