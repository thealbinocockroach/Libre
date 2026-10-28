import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';

interface Paragraph {
  id: string;
  text: string;
  chapterIndex: number;
  paragraphIndex: number;
}

interface Highlight {
  id: string;
  chapterIndex: number;
  startParagraph: number;
  startOffset: number;
  endParagraph: number;
  endOffset: number;
  color: string;
}

interface SearchMatch {
  chapterIndex: number;
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
}

interface VirtualizedParagraphRendererProps {
  paragraphs: Paragraph[];
  highlights: Highlight[];
  searchMatches: SearchMatch[];
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  textAlign: 'left' | 'justify' | 'center';
  theme: { textMain: string; textDim: string; accent: string; overlay: string };
  onParagraphClick: (paragraph: Paragraph, clientX: number, clientY: number) => void;
  onParagraphLongPress: (paragraph: Paragraph, clientX: number, clientY: number) => void;
  onParagraphTouchStart: (paragraph: Paragraph, clientX: number, clientY: number) => void;
  onParagraphTouchEnd: (paragraph: Paragraph) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  scrollTop: number;
  clientHeight: number;
  totalHeight: number;
  onScroll: (top: number) => void;
}

const PARAGRAPH_GAP = 16;
const ESTIMATED_LINE_HEIGHT = 1.5;

function measureParagraphHeight(
  text: string,
  fontSize: number,
  lineHeight: number,
  containerWidth: number
): number {
  const charsPerLine = Math.max(1, Math.floor(containerWidth / (fontSize * 0.6)));
  const lines = Math.ceil(text.length / charsPerLine);
  return lines * fontSize * lineHeight + PARAGRAPH_GAP;
}

export const VirtualizedParagraphRenderer: React.FC<VirtualizedParagraphRendererProps> = ({
  paragraphs,
  highlights,
  searchMatches,
  fontSize,
  lineHeight,
  fontFamily,
  textAlign,
  theme,
  onParagraphClick,
  onParagraphLongPress,
  onParagraphTouchStart,
  onParagraphTouchEnd,
  containerRef,
  scrollTop,
  clientHeight,
  totalHeight,
  onScroll,
}) => {
  const [paragraphHeights, setParagraphHeights] = useState<Map<string, number>>(new Map());
  const [measuredCount, setMeasuredCount] = useState(0);
  const measureObserverRef = useRef<ResizeObserver | null>(null);
  const paragraphRefsRef = useRef<Map<string, HTMLParagraphElement>>(new Map());

  const containerWidth = useMemo(() => {
    if (!containerRef.current) return 700;
    const style = getComputedStyle(containerRef.current);
    const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    return containerRef.current.clientWidth - padding;
  }, [containerRef, paragraphs.length]);

  useEffect(() => {
    if (!containerRef.current) return;
    measureObserverRef.current = new ResizeObserver(entries => {
      for (const entry of entries) {
        const p = entry.target as HTMLParagraphElement;
        const id = p.dataset.paragraphId;
        if (id) {
          setParagraphHeights(prev => {
            const next = new Map(prev);
            next.set(id, entry.contentRect.height);
            return next;
          });
        }
      }
      setMeasuredCount(c => c + 1);
    });

    paragraphRefsRef.current.forEach(ref => {
      if (ref) measureObserverRef.current!.observe(ref);
    });

    return () => measureObserverRef.current?.disconnect();
  }, [containerRef, paragraphs.length]);

  const visibleRange = useMemo(() => {
    let top = 0;
    let startIdx = 0;
    let endIdx = paragraphs.length;

    for (let i = 0; i < paragraphs.length; i++) {
      const h = paragraphHeights.get(paragraphs[i].id) ||
        measureParagraphHeight(paragraphs[i].text, fontSize, lineHeight, containerWidth);
      if (top + h >= scrollTop - 200) {
        startIdx = Math.max(0, i - 2);
        break;
      }
      top += h;
    }

    let accumulated = 0;
    for (let i = startIdx; i < paragraphs.length; i++) {
      const h = paragraphHeights.get(paragraphs[i].id) ||
        measureParagraphHeight(paragraphs[i].text, fontSize, lineHeight, containerWidth);
      accumulated += h;
      if (accumulated > clientHeight + 400) {
        endIdx = i + 3;
        break;
      }
    }

    return { startIdx, endIdx: Math.min(endIdx, paragraphs.length) };
  }, [paragraphs, paragraphHeights, scrollTop, clientHeight, containerWidth, fontSize, lineHeight]);

  const getHighlightStyle = useCallback((para: Paragraph) => {
    const relevantHighlights = highlights.filter(h => h.chapterIndex === para.chapterIndex);
    if (relevantHighlights.length === 0) return {};

    const segments: { start: number; end: number; color: string }[] = [];
    relevantHighlights.forEach(h => {
      if (h.startParagraph === h.endParagraph) {
        if (h.startParagraph === para.paragraphIndex) {
          segments.push({ start: h.startOffset, end: h.endOffset, color: h.color });
        }
      } else {
        if (h.startParagraph === para.paragraphIndex) {
          segments.push({ start: h.startOffset, end: para.text.length, color: h.color });
        } else if (h.endParagraph === para.paragraphIndex) {
          segments.push({ start: 0, end: h.endOffset, color: h.color });
        } else if (para.paragraphIndex > h.startParagraph && para.paragraphIndex < h.endParagraph) {
          segments.push({ start: 0, end: para.text.length, color: h.color });
        }
      }
    });

    return { __highlightSegments: segments };
  }, [highlights]);

  const getSearchHighlightStyle = useCallback((para: Paragraph) => {
    const matches = searchMatches.filter(
      m => m.chapterIndex === para.chapterIndex && m.paragraphIndex === para.paragraphIndex
    );
    return matches.map(m => ({ start: m.startOffset, end: m.endOffset }));
  }, [searchMatches]);

  const renderParagraph = useCallback((para: Paragraph, idx: number) => {
    const highlightData = getHighlightStyle(para);
    const searchData = getSearchHighlightStyle(para);

    const segments = (highlightData as any).__highlightSegments || [];
    const searchSegments = searchData || [];

    let html = '';
    let lastEnd = 0;
    const allMarks = [
      ...segments.map(s => ({ ...s, type: 'highlight' as const })),
      ...searchSegments.map(s => ({ ...s, type: 'search' as const })),
    ].sort((a, b) => a.start - b.start);

    for (const mark of allMarks) {
      if (mark.start > lastEnd) {
        html += para.text.slice(lastEnd, mark.start);
      }
      const className = mark.type === 'highlight'
        ? `libriaudio-hl libriaudio-hl-${mark.color}`
        : 'libriaudio-search-match';
      html += `<mark class="${className}">${para.text.slice(mark.start, mark.end)}</mark>`;
      lastEnd = mark.end;
    }
    if (lastEnd < para.text.length) {
      html += para.text.slice(lastEnd);
    }

    return (
      <p
        ref={el => { if (el) paragraphRefsRef.current.set(para.id, el); }}
        key={para.id}
        data-paragraph-id={para.id}
        data-chapter-index={para.chapterIndex}
        data-paragraph-index={para.paragraphIndex}
        style={{
          fontSize: `${fontSize}px`,
          lineHeight,
          fontFamily,
          textAlign,
          color: theme.textMain,
          margin: 0,
          padding: `0 0 ${PARAGRAPH_GAP}px`,
        }}
        onClick={e => onParagraphClick(para, e.clientX, e.clientY)}
        onContextMenu={e => { e.preventDefault(); onParagraphLongPress(para, e.clientX, e.clientY); }}
        onTouchStart={e => onParagraphTouchStart(para, e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={e => onParagraphTouchEnd(para)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }, [fontSize, lineHeight, fontFamily, textAlign, theme.textMain, getHighlightStyle, getSearchHighlightStyle, onParagraphClick, onParagraphLongPress, onParagraphTouchStart, onParagraphTouchEnd]);

  const visibleParagraphs = paragraphs.slice(visibleRange.startIdx, visibleRange.endIdx);

  return (
    <div
      ref={containerRef}
      style={{
        height: totalHeight,
        position: 'relative',
        overflow: 'hidden',
      }}
      onScroll={e => onScroll((e.target as HTMLDivElement).scrollTop)}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        {visibleParagraphs.map(renderParagraph)}
      </div>
    </div>
  );
};