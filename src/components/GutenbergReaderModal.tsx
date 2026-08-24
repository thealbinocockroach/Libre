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
  Book as BookIcon,
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
  DictionaryResult,
  PlayerState,
} from '../types';
import { getEbookCloudUrl, CLASSIC_EBOOKS, findClassicEbook } from '../data/ebookData';
import { parseUploadedEpub, splitManuscriptIntoChapters } from '../utils/epubParser';
import {
  saveOfflineEbook,
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
};

const HIGHLIGHT_COLORS: { id: HighlightColor; name: string; bg: string; border: string; dot: string }[] = [
  { id: 'gold', name: 'Gold', bg: 'bg-amber-400/25', border: 'border-amber-400', dot: 'bg-amber-400' },
  { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-400/25', border: 'border-emerald-400', dot: 'bg-emerald-400' },
  { id: 'sapphire', name: 'Sapphire', bg: 'bg-blue-400/25', border: 'border-blue-400', dot: 'bg-blue-400' },
  { id: 'amethyst', name: 'Amethyst', bg: 'bg-purple-400/25', border: 'border-purple-400', dot: 'bg-purple-400' },
];

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
    'chapters' | 'highlights' | 'search' | 'dictionary' | 'bookmarks' | null
  >(null);

  // Selection Floating Menu
  const [selectionMenu, setSelectionMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    text: string;
  } | null>(null);

  // Add / Edit Note Dialog
  const [noteDialog, setNoteDialog] = useState<{
    isOpen: boolean;
    annotationId?: string;
    text: string;
    note: string;
    color: HighlightColor;
  } | null>(null);

  // Selected highlight bubble when clicking highlighted text
  const [activeHighlightPopup, setActiveHighlightPopup] = useState<{
    annotation: EbookAnnotation;
    x: number;
    y: number;
  } | null>(null);

  // Dictionary State
  const [dictionaryWord, setDictionaryWord] = useState('');
  const [dictionaryData, setDictionaryData] = useState<DictionaryResult | null>(null);
  const [isDictLoading, setIsDictLoading] = useState(false);
  const [dictError, setDictError] = useState<string | null>(null);

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
  const articleRef = useRef<HTMLElement>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const sessionSecondsRef = useRef<number>(0);
  const lastFlushedSecondsRef = useRef<number>(0);
  const targetScrollPercentageRef = useRef<number>(0);
  const isRestoringPositionRef = useRef<boolean>(false);

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
        recordReadingSession({
          bookId: currentBook.id,
          bookTitle: currentBook.title,
          bookAuthor: currentBook.author,
          coverImageUrl: currentBook.coverImageUrl,
          chapterIndex: currentChapterIndex,
          chapterTitle: currentChapterTitle,
          durationSeconds: sessionSecondsRef.current,
          startTimestamp: sessionStartRef.current,
          endTimestamp: Date.now(),
          scrollPercentage: scrollProgress,
        });
      }

      updateEbookReadingPosition(currentBook.id, currentChapterIndex, scrollProgress);
    };
  }, [isOpen, currentBook.id, currentChapterIndex]);

  // Fetch or extract reader content (with IndexedDB offline cache priority)
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    const loadContent = async () => {
      setIsLoading(true);
      setError(null);
      setSelectionMenu(null);
      setActiveHighlightPopup(null);

      // 1. Check IndexedDB Offline Cache first (instant offline availability)
      try {
        const storedEbook = await getOfflineEbook(currentBook.id);
        if (storedEbook && storedEbook.chapters && storedEbook.chapters.length > 0) {
          if (isMounted) {
            setCurrentBook((prev) => ({ ...prev, ebookChapters: storedEbook.chapters }));
            const targetIndex =
              currentChapterIndex < storedEbook.chapters.length
                ? currentChapterIndex
                : storedEbook.lastReadChapterIndex || 0;
            const activeChapter =
              storedEbook.chapters[targetIndex] || storedEbook.chapters[0];
            setHtmlContent(activeChapter.content);
            setIsStoredOffline(true);
            setStoredSizeBytes(storedEbook.sizeBytes || 0);
            setIsLoading(false);
          }
          return;
        }
      } catch (e) {
        console.warn('Error checking offline stored ebook:', e);
      }

      // 2. If book has pre-parsed ebookChapters (e.g. from uploaded EPUB)
      if (currentBook.ebookChapters && currentBook.ebookChapters.length > 0) {
        const activeChapter =
          currentBook.ebookChapters[currentChapterIndex] || currentBook.ebookChapters[0];
        if (isMounted) {
          setHtmlContent(activeChapter.content);
          setIsLoading(false);
          // Persist to offline IndexedDB
          saveOfflineEbook(currentBook, currentBook.ebookChapters, activeChapter.content);
          setIsStoredOffline(true);
        }
        return;
      }

      // 3. If curated in CLASSIC_EBOOKS or fuzzy matched
      const classic = findClassicEbook(currentBook);
      if (classic && classic.chapters && classic.chapters.length > 0) {
        if (isMounted) {
          setCurrentBook((prev) => ({ ...prev, ebookChapters: classic.chapters }));
          const activeChapter = classic.chapters[currentChapterIndex] || classic.chapters[0];
          setHtmlContent(activeChapter.content);
          setIsLoading(false);
          // Persist to offline IndexedDB
          saveOfflineEbook(currentBook, classic.chapters, activeChapter.content);
          setIsStoredOffline(true);
        }
        return;
      }

      // 4. Fetch from Project Gutenberg text proxy
      try {
        const url = await getEbookCloudUrl(currentBook.title);
        if (!url) {
          throw new Error('No public digital manuscript found for this title.');
        }

        const res = await fetch(`/api/gutenberg/text?url=${encodeURIComponent(url)}`);
        if (!res.ok) {
          throw new Error('Failed to load text manuscript from archive proxy');
        }

        const text = await res.text();

        if (isMounted) {
          const parsedChapters = splitManuscriptIntoChapters(text, currentBook.title);
          setCurrentBook((prev) => ({ ...prev, ebookChapters: parsedChapters }));
          const activeChapter = parsedChapters[currentChapterIndex] || parsedChapters[0];
          const contentToRender = activeChapter ? activeChapter.content : text;
          setHtmlContent(contentToRender);

          // Persist to offline IndexedDB
          saveOfflineEbook(currentBook, parsedChapters, text);
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

    // Dismiss floating selection on active scroll
    if (selectionMenu) setSelectionMenu(null);
    if (activeHighlightPopup) setActiveHighlightPopup(null);
  };

  // Text selection detection
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionMenu(null);
      return;
    }

    const text = selection.toString().trim();
    if (!text || text.length < 2) {
      setSelectionMenu(null);
      return;
    }

    // Ensure selection is inside the reader article
    if (articleRef.current && articleRef.current.contains(selection.anchorNode)) {
      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setSelectionMenu({
            visible: true,
            x: Math.max(20, Math.min(window.innerWidth - 280, rect.left + rect.width / 2 - 130)),
            y: Math.max(70, rect.top - 54),
            text,
          });
        }
      } catch {
        setSelectionMenu(null);
      }
    } else {
      setSelectionMenu(null);
    }
  };

  // Create Highlight
  const createHighlight = (color: HighlightColor) => {
    if (!selectionMenu || !selectionMenu.text) return;
    const currentChapterTitle =
      currentBook.ebookChapters?.[currentChapterIndex]?.title ||
      `Chapter ${currentChapterIndex + 1}`;

    const newAnnotation: EbookAnnotation = {
      id: `ann_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      bookId: currentBook.id,
      chapterIndex: currentChapterIndex,
      chapterTitle: currentChapterTitle,
      text: selectionMenu.text,
      color,
      createdAt: Date.now(),
    };

    saveAnnotations([...annotations, newAnnotation]);
    setSelectionMenu(null);
    window.getSelection()?.removeAllRanges();
  };

  // Open Note Creator from selection
  const openNoteFromSelection = () => {
    if (!selectionMenu || !selectionMenu.text) return;
    setNoteDialog({
      isOpen: true,
      text: selectionMenu.text,
      note: '',
      color: 'gold',
    });
    setSelectionMenu(null);
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
      saveAnnotations(updated);
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
      };
      saveAnnotations([...annotations, newAnn]);
    }

    setNoteDialog(null);
    window.getSelection()?.removeAllRanges();
  };

  // Delete Annotation
  const handleDeleteAnnotation = (id: string) => {
    const updated = annotations.filter((a) => a.id !== id);
    saveAnnotations(updated);
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

  // Lookup word in Dictionary
  const lookupDictionary = async (wordToSearch: string) => {
    const clean = wordToSearch.replace(/[^a-zA-Z]/g, '').toLowerCase().trim();
    if (!clean) return;

    setDictionaryWord(clean);
    setIsDictLoading(true);
    setDictError(null);
    setDictionaryData(null);
    setActiveSidebarTab('dictionary');

    try {
      const res = await fetch(`/api/dictionary/${encodeURIComponent(clean)}`);
      if (!res.ok) {
        throw new Error(`No definition found for "${clean}".`);
      }
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setDictionaryData(data[0]);
      } else {
        throw new Error('Definition data format unexpected.');
      }
    } catch (err) {
      setDictError(err instanceof Error ? err.message : 'Lookup failed.');
    } finally {
      setIsDictLoading(false);
    }
  };

  // Copy selection
  const handleCopySelection = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedState(true);
    setTimeout(() => {
      setCopiedState(false);
      setSelectionMenu(null);
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

      // 2. Safe Text-Node-Only Highlighting (avoids corrupting image tags or attributes)
      const currentChapterAnn = annotations.filter(
        (a) => a.chapterIndex === currentChapterIndex
      );
      const sortedAnn = [...currentChapterAnn].sort((a, b) => b.text.length - a.text.length);
      const hasSearch = searchQuery.trim().length > 1;

      if (sortedAnn.length > 0 || hasSearch) {
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
        const textNodes: Text[] = [];
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const parent = node.parentElement;
          if (
            parent &&
            !['script', 'style', 'mark', 'button', 'noscript'].includes(
              parent.tagName.toLowerCase()
            )
          ) {
            textNodes.push(node as Text);
          }
        }

        textNodes.forEach((textNode) => {
          const originalText = textNode.nodeValue || '';
          if (!originalText.trim()) return;

          let hasMatches = false;
          let html = originalText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

          // Apply annotations safely to text
          sortedAnn.forEach((ann) => {
            if (originalText.toLowerCase().includes(ann.text.toLowerCase())) {
              const escaped = ann.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(`(${escaped})`, 'gi');
              html = html.replace(
                regex,
                `<mark class="libriaudio-hl libriaudio-hl-${ann.color}" data-annotation-id="${ann.id}">$1</mark>`
              );
              hasMatches = true;
            }
          });

          // Apply search matches safely to text
          if (hasSearch && originalText.toLowerCase().includes(searchQuery.trim().toLowerCase())) {
            const escaped = searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const searchRegex = new RegExp(`(${escaped})`, 'gi');
            html = html.replace(searchRegex, `<mark class="libriaudio-search-match">$1</mark>`);
            hasMatches = true;
          }

          if (hasMatches && textNode.parentNode) {
            const span = doc.createElement('span');
            span.innerHTML = html;
            textNode.parentNode.replaceChild(span, textNode);
          }
        });
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

  // Click on Highlight in Text to open mini action card
  const handleContentClick = (e: React.MouseEvent) => {
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
        else if (selectionMenu) setSelectionMenu(null);
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
      bg: 'bg-[#0A0A0A]',
      text: 'text-[#E2E8F0]',
      header: 'bg-[#121212]/95 border-white/10 shadow-lg text-white',
      panel: 'bg-[#141414] border-white/10 shadow-2xl text-white',
      prose: 'prose-invert',
      accent: 'text-[#C5A059]',
      button: 'hover:bg-white/10 text-white/80 hover:text-white',
      badge: 'bg-white/5 border-white/10 text-white/70',
      divider: 'border-white/10',
    },
    sepia: {
      bg: 'bg-[#F5EFE1]',
      text: 'text-[#382E1E]',
      header: 'bg-[#EAE2CF]/95 border-black/10 shadow-md text-[#382E1E]',
      panel: 'bg-[#EFE7D5] border-black/15 shadow-2xl text-[#382E1E]',
      prose: 'prose-amber',
      accent: 'text-[#B45309]',
      button: 'hover:bg-black/5 text-[#382E1E]/80 hover:text-[#382E1E]',
      badge: 'bg-black/5 border-black/10 text-[#382E1E]/70',
      divider: 'border-black/10',
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
      header: 'bg-[#0F172A]/95 border-blue-500/20 shadow-lg text-white',
      panel: 'bg-[#0F172A] border-blue-500/20 shadow-2xl text-white',
      prose: 'prose-invert',
      accent: 'text-[#38BDF8]',
      button: 'hover:bg-white/10 text-blue-100 hover:text-white',
      badge: 'bg-blue-900/30 border-blue-500/20 text-blue-200',
      divider: 'border-blue-500/20',
    },
    oled: {
      bg: 'bg-[#000000]',
      text: 'text-[#D1D5DB]',
      header: 'bg-[#050505]/95 border-white/5 shadow-none text-white',
      panel: 'bg-[#0A0A0A] border-white/10 shadow-2xl text-white',
      prose: 'prose-invert',
      accent: 'text-[#C5A059]',
      button: 'hover:bg-white/10 text-white/70 hover:text-white',
      badge: 'bg-white/5 border-white/10 text-white/60',
      divider: 'border-white/10',
    },
  };

  const currentTheme = themeStyles[settings.theme] || themeStyles.obsidian;
  const hasChapters = currentBook.ebookChapters && currentBook.ebookChapters.length > 1;

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
      className={`fixed inset-0 z-50 flex flex-col animate-in fade-in duration-200 overflow-hidden select-text ${currentTheme.bg} ${currentTheme.text} ${fontFamilies[settings.fontFamily]}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".epub,.txt,.html,.htm"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Top Reading Progress Line */}
      <div className="w-full h-1 bg-white/5 shrink-0 relative overflow-hidden">
        <div
          className="h-full bg-[#C5A059] transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Reader Top App Bar */}
      <header
        className={`h-14 border-b flex items-center justify-between px-3 sm:px-6 shrink-0 z-20 backdrop-blur-md ${currentTheme.header}`}
      >
        <div className="flex items-center gap-3 overflow-hidden min-w-0">
          <BookOpen className="w-5 h-5 text-[#C5A059] shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate font-sans tracking-tight">
              {currentBook.title}
            </h2>
            <div className="flex items-center gap-2 text-[11px] font-sans opacity-70 truncate flex-wrap">
              <span>{currentBook.author}</span>
              {currentBook.ebookChapters && currentBook.ebookChapters.length > 0 && (
                <>
                  <span>•</span>
                  <span className="font-mono text-[#C5A059]">
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
              onClick={() => setShowThreeDotMenu(!showThreeDotMenu)}
              className={`p-2 rounded-xl border transition-all ${
                showThreeDotMenu
                  ? 'bg-[#C5A059] text-black border-[#C5A059]'
                  : `border-transparent ${currentTheme.button}`
              }`}
              title="More Reader Features"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {/* Three-Dot Dropdown Menu */}
            {showThreeDotMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-[#141414] border border-white/10 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 border-b border-white/10 mb-1">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-[#C5A059]">Reader Tools</p>
                </div>
                <button
                  onClick={() => {
                    setShowThreeDotMenu(false);
                    setActiveSidebarTab('search');
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs flex items-center gap-2.5 hover:bg-white/10 transition-colors text-white/90"
                >
                  <Search className="w-4 h-4 text-[#C5A059]" />
                  <span>Search in Book</span>
                </button>
                <button
                  onClick={() => {
                    setShowThreeDotMenu(false);
                    setActiveSidebarTab('dictionary');
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs flex items-center gap-2.5 hover:bg-white/10 transition-colors text-white/90"
                >
                  <BookIcon className="w-4 h-4 text-[#C5A059]" />
                  <span>Dictionary Lookup</span>
                </button>
                <div className="my-1 border-t border-white/10" />
                {annotations.length > 0 && (
                  <button
                    onClick={() => {
                      setShowThreeDotMenu(false);
                      handleExportAnnotations();
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs flex items-center gap-2.5 hover:bg-white/10 transition-colors text-white/90"
                  >
                    <Download className="w-4 h-4 text-[#C5A059]" />
                    <span>Export Highlights ({annotations.length})</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowThreeDotMenu(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs flex items-center gap-2.5 hover:bg-white/10 transition-colors text-white/90"
                >
                  <Upload className="w-4 h-4 text-[#C5A059]" />
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
          onMouseUp={handleTextSelection}
          onTouchEnd={handleTextSelection}
          onClick={handleContentClick}
          className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-black/20 pb-32 transition-all relative"
        >
          <div className={`${columnWidths[settings.columnWidth]} mx-auto px-5 py-8 md:px-12 md:py-12`}>
            {isLoading ? (
              <div className="space-y-6 py-6 animate-pulse">
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="h-4 w-48 bg-white/10 rounded" />
                  <div className="h-3 w-24 bg-white/10 rounded" />
                </div>
                <div className="space-y-4">
                  <div className="h-6 w-3/4 bg-white/10 rounded" />
                  <div className="h-4 w-full bg-white/5 rounded" />
                  <div className="h-4 w-full bg-white/5 rounded" />
                  <div className="h-4 w-5/6 bg-white/5 rounded" />
                  <div className="h-4 w-full bg-white/5 rounded" />
                  <div className="h-4 w-4/5 bg-white/5 rounded" />
                  <div className="h-6 w-1/2 bg-white/10 rounded mt-8" />
                  <div className="h-4 w-full bg-white/5 rounded" />
                  <div className="h-4 w-full bg-white/5 rounded" />
                  <div className="h-4 w-3/4 bg-white/5 rounded" />
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-20 opacity-90 max-w-md mx-auto space-y-5 font-sans">
                <div className="w-14 h-14 rounded-2xl bg-[#C5A059]/10 text-[#C5A059] border border-[#C5A059]/20 flex items-center justify-center mx-auto">
                  <BookOpen className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#C5A059]">Digital Text Unbound</p>
                  <p className="text-xs opacity-65 leading-relaxed">
                    We could not auto-fetch the digital Gutenberg manuscript for this title. You can import any local .epub or .txt file to read seamlessly!
                  </p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-5 py-2.5 rounded-xl bg-[#C5A059] hover:bg-[#d4af65] text-black font-semibold text-xs inline-flex items-center gap-2 transition-all shadow-lg cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isUploading ? 'Parsing Document...' : 'Upload EPUB to Read'}</span>
                </button>
              </div>
            ) : (
              <>
                {/* Chapter Title Header inside text */}
                <div className="mb-8 pb-4 border-b border-white/10 flex items-center justify-between font-sans text-xs opacity-60">
                  <span>
                    {currentBook.ebookChapters?.[currentChapterIndex]?.title || currentBook.title}
                  </span>
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span>{readingStats.words} words</span>
                    <span>•</span>
                    <span>~{readingStats.minutes} min read</span>
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
                  <div className="mt-16 pt-8 border-t border-white/10 font-sans">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      {currentChapterIndex > 0 ? (
                        <button
                          onClick={() => {
                            setCurrentChapterIndex(currentChapterIndex - 1);
                            targetScrollPercentageRef.current = 0;
                            contentContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="w-full sm:w-auto px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4 text-[#C5A059]" />
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
                          className="w-full sm:w-auto px-4 py-3 rounded-xl bg-[#C5A059] hover:bg-[#d4af65] text-black font-semibold text-xs flex items-center justify-between gap-2 transition-colors shadow-lg cursor-pointer ml-auto"
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
                {activeSidebarTab === 'chapters' && <List className="w-4 h-4 text-[#C5A059]" />}
                {activeSidebarTab === 'highlights' && <Highlighter className="w-4 h-4 text-[#C5A059]" />}
                {activeSidebarTab === 'search' && <Search className="w-4 h-4 text-[#C5A059]" />}
                {activeSidebarTab === 'dictionary' && <BookIcon className="w-4 h-4 text-[#C5A059]" />}
                {activeSidebarTab === 'bookmarks' && <BookmarkIcon className="w-4 h-4 text-[#C5A059]" />}
                <h3 className="text-xs uppercase font-bold tracking-wider opacity-90">
                  {activeSidebarTab === 'chapters' && 'Table of Contents'}
                  {activeSidebarTab === 'highlights' && `Highlights & Notes (${annotations.length})`}
                  {activeSidebarTab === 'search' && 'Search in Book'}
                  {activeSidebarTab === 'dictionary' && 'Dictionary'}
                  {activeSidebarTab === 'bookmarks' && `Bookmarks (${bookmarks.length})`}
                </h3>
              </div>
              <div className="flex items-center gap-1">
                {activeSidebarTab === 'highlights' && annotations.length > 0 && (
                  <button
                    onClick={handleExportAnnotations}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-xs text-[#C5A059] flex items-center gap-1 font-medium transition-colors"
                    title="Export Annotations as Markdown"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Export</span>
                  </button>
                )}
                <button
                  onClick={() => setActiveSidebarTab(null)}
                  className="p-1 rounded-lg hover:bg-white/10 opacity-60 hover:opacity-100 transition-colors"
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
                            ? 'bg-[#C5A059] text-black font-semibold shadow-md'
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
                      <Highlighter className="w-8 h-8 mx-auto text-[#C5A059]/40 mb-2" />
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
                          className={`p-3.5 rounded-xl border ${currentTheme.badge} space-y-2 hover:border-[#C5A059]/40 transition-colors`}
                        >
                          <div className="flex items-center justify-between text-[10px] opacity-65">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${colorDef?.dot || 'bg-amber-400'}`} />
                              <span className="font-medium truncate max-w-[140px]">{ann.chapterTitle}</span>
                            </div>
                            <span>{new Date(ann.createdAt).toLocaleDateString()}</span>
                          </div>

                          <blockquote className="text-xs italic border-l-2 pl-2.5 border-[#C5A059]/60 line-clamp-3 opacity-90">
                            "{ann.text}"
                          </blockquote>

                          {ann.note && (
                            <div className="bg-white/5 p-2 rounded-lg text-xs flex items-start gap-1.5 text-[#C5A059]">
                              <StickyNote className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <p className="opacity-95 leading-relaxed">{ann.note}</p>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
                            <button
                              onClick={() => {
                                setCurrentChapterIndex(ann.chapterIndex);
                                setActiveSidebarTab(null);
                              }}
                              className="text-[#C5A059] hover:underline font-medium flex items-center gap-1"
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
                                  })
                                }
                                className="opacity-70 hover:opacity-100 hover:text-[#C5A059]"
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
                      className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs focus:outline-none focus:border-[#C5A059]"
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
                      <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
                        <span className="text-[#C5A059] font-medium">
                          {totalSearchMatches} {totalSearchMatches === 1 ? 'match' : 'matches'} found
                        </span>
                        <span className="opacity-60 text-[11px]">
                          across {crossChapterSearchResults.length} {crossChapterSearchResults.length === 1 ? 'chapter' : 'chapters'}
                        </span>
                      </div>

                      {crossChapterSearchResults.length === 0 ? (
                        <div className="text-center py-10 opacity-60 text-xs space-y-1">
                          <p className="font-semibold text-white/80">No matches found</p>
                          <p className="text-[11px] opacity-60">Try searching for a different word or phrase.</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                          {crossChapterSearchResults.map((chRes) => (
                            <div
                              key={chRes.chapterIndex}
                              className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2"
                            >
                              <div className="flex items-center justify-between text-[11px] font-semibold text-[#C5A059]">
                                <span className="truncate pr-2">{chRes.chapterTitle}</span>
                                <span className="px-1.5 py-0.5 rounded bg-[#C5A059]/20 text-[10px] font-mono shrink-0">
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
                                    className="w-full text-left p-2 rounded-lg bg-black/20 hover:bg-[#C5A059]/15 border border-transparent hover:border-[#C5A059]/30 text-[11px] leading-relaxed transition-all block cursor-pointer"
                                  >
                                    <span className="opacity-70">{m.before}</span>
                                    <mark className="bg-[#C5A059] text-black font-semibold px-1 rounded-sm mx-0.5">
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

              {/* 4. Dictionary Lookup Tab */}
              {activeSidebarTab === 'dictionary' && (
                <div className="space-y-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      lookupDictionary(dictionaryWord);
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={dictionaryWord}
                      onChange={(e) => setDictionaryWord(e.target.value)}
                      placeholder="Look up word definition..."
                      className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs focus:outline-none focus:border-[#C5A059]"
                    />
                    <button
                      type="submit"
                      disabled={isDictLoading || !dictionaryWord.trim()}
                      className="px-3 py-2 rounded-xl bg-[#C5A059] text-black font-semibold text-xs disabled:opacity-50"
                    >
                      Define
                    </button>
                  </form>

                  {isDictLoading ? (
                    <div className="text-center py-8 opacity-60">
                      <div className="w-6 h-6 rounded-full border-2 border-t-[#C5A059] border-white/10 animate-spin mx-auto mb-2" />
                      <p className="text-xs">Fetching definition...</p>
                    </div>
                  ) : dictError ? (
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs opacity-80 text-center space-y-1">
                      <p className="font-semibold text-[#C5A059]">Word not found</p>
                      <p className="text-[11px] opacity-70">{dictError}</p>
                    </div>
                  ) : dictionaryData ? (
                    <div className="space-y-4 text-xs animate-in fade-in">
                      <div className="border-b border-white/10 pb-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-base font-bold capitalize text-[#C5A059]">
                            {dictionaryData.word}
                          </h4>
                          {dictionaryData.phonetic && (
                            <span className="font-mono text-[11px] opacity-60">
                              {dictionaryData.phonetic}
                            </span>
                          )}
                        </div>
                      </div>

                      {dictionaryData.meanings?.map((m, idx) => (
                        <div key={idx} className="space-y-2">
                          <span className="px-2 py-0.5 rounded-md bg-[#C5A059]/15 text-[#C5A059] text-[10px] font-semibold uppercase tracking-wider">
                            {m.partOfSpeech}
                          </span>
                          <ul className="space-y-2 pl-2">
                            {m.definitions?.slice(0, 3).map((d, dIdx) => (
                              <li key={dIdx} className="space-y-1">
                                <p className="opacity-90 leading-relaxed">• {d.definition}</p>
                                {d.example && (
                                  <p className="text-[11px] italic opacity-60 pl-2">
                                    "{d.example}"
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 opacity-50 text-xs">
                      Select any word in the book or search above to view its definition, pronunciation, and examples.
                    </div>
                  )}
                </div>
              )}

              {/* 5. Bookmarks Tab */}
              {activeSidebarTab === 'bookmarks' && (
                <div className="space-y-3">
                  <button
                    onClick={handleAddBookmark}
                    className="w-full py-2.5 rounded-xl bg-[#C5A059] text-black font-semibold text-xs flex items-center justify-center gap-2 hover:bg-[#d4af65] transition-colors"
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
                          onClick={() => {
                            setCurrentChapterIndex(bm.chapterIndex);
                            setActiveSidebarTab(null);
                          }}
                          className="cursor-pointer space-y-0.5 flex-1 pr-2"
                        >
                          <p className="font-semibold text-[#C5A059] truncate">{bm.chapterTitle}</p>
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

      {/* Floating Selection Toolbar */}
      {selectionMenu && selectionMenu.visible && (
        <div
          id="reader-floating-selection-menu"
          className="fixed z-50 flex items-center gap-1 bg-[#111111]/95 backdrop-blur-md border border-white/20 px-2 py-1.5 rounded-full shadow-2xl animate-in zoom-in-95 duration-100 text-white font-sans text-xs"
          style={{ top: `${selectionMenu.y}px`, left: `${selectionMenu.x}px` }}
        >
          {/* Highlight Color Pickers */}
          <div className="flex items-center gap-1 px-1 border-r border-white/15">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => createHighlight(c.id)}
                className={`w-5 h-5 rounded-full ${c.dot} hover:scale-110 transition-transform`}
                title={`Highlight in ${c.name}`}
              />
            ))}
          </div>

          {/* Add Note Button */}
          <button
            onClick={openNoteFromSelection}
            className="p-1.5 rounded-lg hover:bg-white/15 flex items-center gap-1 text-[#C5A059] font-medium"
            title="Attach Note"
          >
            <StickyNote className="w-3.5 h-3.5" />
            <span className="text-[11px]">Note</span>
          </button>

          {/* Define in Dictionary */}
          <button
            onClick={() => lookupDictionary(selectionMenu.text)}
            className="p-1.5 rounded-lg hover:bg-white/15 flex items-center gap-1 font-medium"
            title="Define Word"
          >
            <BookIcon className="w-3.5 h-3.5" />
            <span className="text-[11px]">Define</span>
          </button>

          {/* Copy Text */}
          <button
            onClick={() => handleCopySelection(selectionMenu.text)}
            className="p-1.5 rounded-lg hover:bg-white/15 flex items-center gap-1"
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
          className="fixed z-50 p-3.5 rounded-2xl bg-[#181818]/95 backdrop-blur-md border border-white/20 shadow-2xl font-sans text-xs w-72 text-white animate-in zoom-in-95 duration-100"
          style={{ top: `${activeHighlightPopup.y}px`, left: `${activeHighlightPopup.x}px` }}
        >
          <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  HIGHLIGHT_COLORS.find((c) => c.id === activeHighlightPopup.annotation.color)?.dot || 'bg-amber-400'
                }`}
              />
              <span className="font-bold text-[11px] uppercase tracking-wider text-[#C5A059]">
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

          <blockquote className="italic opacity-80 text-[11px] line-clamp-2 mb-2 pl-2 border-l-2 border-[#C5A059]">
            "{activeHighlightPopup.annotation.text}"
          </blockquote>

          {activeHighlightPopup.annotation.note ? (
            <div className="bg-white/5 p-2 rounded-xl text-[11px] mb-3 text-[#C5A059]">
              <span className="font-semibold block text-[10px] uppercase opacity-70 mb-0.5">Note</span>
              <p className="opacity-95">{activeHighlightPopup.annotation.note}</p>
            </div>
          ) : (
            <p className="text-[10px] opacity-50 mb-3">No note attached to this highlight.</p>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[11px]">
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
                });
              }}
              className="text-[#C5A059] font-medium hover:underline"
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
          <div className="bg-[#141414] border border-white/15 rounded-2xl max-w-md w-full p-5 shadow-2xl font-sans text-white space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-[#C5A059]" />
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

            <blockquote className="text-xs italic p-3 rounded-xl bg-white/5 border-l-2 border-[#C5A059] opacity-80 max-h-24 overflow-y-auto">
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
                className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-xs focus:outline-none focus:border-[#C5A059] resize-none"
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
                  className="px-4 py-2 rounded-xl bg-[#C5A059] hover:bg-[#d4af65] text-black font-semibold text-xs transition-colors"
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reader Typography & Appearance Floating Settings Panel */}
      {showSettingsDropdown && (
        <div
          id="reader-settings-panel"
          className={`absolute top-15 right-4 p-5 rounded-2xl border z-40 w-80 shadow-2xl font-sans animate-in slide-in-from-top-2 duration-150 ${currentTheme.panel}`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
            <h3 className="text-xs uppercase font-bold text-[#C5A059] tracking-wider">
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
                  { id: 'obsidian', label: 'Obsidian', bg: 'bg-[#0A0A0A]', text: 'text-white' },
                  { id: 'sepia', label: 'Sepia', bg: 'bg-[#F5EFE1]', text: 'text-[#382E1E]' },
                  { id: 'paper', label: 'Paper', bg: 'bg-white', text: 'text-gray-900' },
                  { id: 'midnight', label: 'Midnight', bg: 'bg-[#090D16]', text: 'text-blue-100' },
                  { id: 'oled', label: 'OLED', bg: 'bg-black', text: 'text-white' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => updateSettings({ theme: t.id as any })}
                    className={`py-1.5 px-2 rounded-xl border text-center font-medium transition-all ${t.bg} ${t.text} ${
                      settings.theme === t.id
                        ? 'border-[#C5A059] ring-1 ring-[#C5A059] shadow-md'
                        : 'border-white/10 opacity-70 hover:opacity-100'
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
                        ? 'bg-[#C5A059] text-black font-semibold border-[#C5A059]'
                        : 'bg-white/5 border-white/10 opacity-80 hover:opacity-100'
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
                <span className="font-mono text-xs text-[#C5A059]">{settings.fontSize}px</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateSettings({ fontSize: Math.max(12, settings.fontSize - 1) })}
                  className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center font-bold"
                >
                  A-
                </button>
                <input
                  type="range"
                  min="12"
                  max="32"
                  value={settings.fontSize}
                  onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value, 10) })}
                  className="flex-1 accent-[#C5A059]"
                />
                <button
                  onClick={() => updateSettings({ fontSize: Math.min(32, settings.fontSize + 1) })}
                  className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center font-bold"
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
                          ? 'bg-[#C5A059] text-black font-semibold border-[#C5A059]'
                          : 'bg-white/5 border-white/10 opacity-70'
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
                        ? 'bg-[#C5A059] text-black border-[#C5A059]'
                        : 'bg-white/5 border-white/10 opacity-70'
                    }`}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => updateSettings({ textAlign: 'justify' })}
                    className={`flex-1 py-1 rounded-lg border flex items-center justify-center transition-all ${
                      settings.textAlign === 'justify'
                        ? 'bg-[#C5A059] text-black border-[#C5A059]'
                        : 'bg-white/5 border-white/10 opacity-70'
                    }`}
                  >
                    <AlignJustify className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Swipe / Scroll Chapter Navigation Option */}
            <div className="pt-2 border-t border-white/10">
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
                        ? 'bg-[#C5A059] text-black font-semibold border-[#C5A059]'
                        : 'bg-white/5 border-white/10 opacity-70 hover:opacity-100'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Bottom Essentials & Chapter Navigation Bar */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[#121212]/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 shadow-2xl text-white font-sans text-xs z-30 max-w-[95vw] overflow-x-auto scrollbar-none">
        {/* Table of Contents */}
        <button
          id="btn-reader-bottom-toc"
          onClick={() => setActiveSidebarTab(activeSidebarTab === 'chapters' ? null : 'chapters')}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            activeSidebarTab === 'chapters'
              ? 'bg-[#C5A059] text-black border-[#C5A059]'
              : 'border-transparent hover:bg-white/10 text-white/80'
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
              ? 'bg-[#C5A059] text-black border-[#C5A059]'
              : 'border-transparent hover:bg-white/10 text-white/80'
          }`}
          title="Highlights & Notes"
        >
          <Highlighter className="w-4 h-4" />
          {annotations.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#C5A059] text-black font-bold text-[9px] flex items-center justify-center">
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
              ? 'bg-[#C5A059] text-black border-[#C5A059]'
              : 'border-transparent hover:bg-white/10 text-white/80'
          }`}
          title="Bookmark Current Page"
        >
          <BookmarkIcon className="w-4 h-4" />
        </button>

        {/* Typography & Settings */}
        <button
          id="btn-reader-bottom-settings"
          onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            showSettingsDropdown
              ? 'bg-white/20 border-white/20'
              : 'border-transparent hover:bg-white/10 text-white/80'
          }`}
          title="Reader Display Settings"
        >
          <Settings2 className="w-4 h-4" />
        </button>

        {/* Audiobook Playback Controls while reading */}
        {onTogglePlayPause && (
          <>
            <div className="h-4 w-px bg-white/10 mx-0.5" />
            <button
              onClick={onRewind15}
              className="p-1.5 rounded-full hover:bg-white/10 text-white/80 transition-colors cursor-pointer"
              title="Rewind 15s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onTogglePlayPause}
              className="p-2 rounded-full bg-[#C5A059] text-black hover:bg-[#d4af65] transition-all shadow-md active:scale-95 cursor-pointer"
              title={playerState?.isPlaying ? 'Pause Audiobook' : 'Play Audiobook'}
            >
              {playerState?.isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
            <button
              onClick={onForward30}
              className="p-1.5 rounded-full hover:bg-white/10 text-white/80 transition-colors cursor-pointer"
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
