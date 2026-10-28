import React, { useRef, useCallback, useEffect, useState } from 'react';

export interface TextPosition {
  chapterIndex: number;
  paragraphIndex: number;
  offset: number;
}

export interface SelectionRange {
  start: TextPosition;
  end: TextPosition;
}

export interface SelectionRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface ParagraphElement {
  element: HTMLParagraphElement;
  paragraph: {
    id: string;
    chapterIndex: number;
    paragraphIndex: number;
    text: string;
  };
}

export function useTextSelection(
  containerRef: React.RefObject<HTMLDivElement>,
  paragraphs: { id: string; chapterIndex: number; paragraphIndex: number; text: string }[]
) {
  const paragraphElementsRef = useRef<Map<string, ParagraphElement>>(new Map());
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [selectionRects, setSelectionRects] = useState<SelectionRect[]>([]);
  const [handlePositions, setHandlePositions] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const dragHandleRef = useRef<'start' | 'end' | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressArmedRef = useRef(false);

  const registerParagraph = useCallback((id: string, element: HTMLParagraphElement, paragraph: ParagraphElement['paragraph']) => {
    paragraphElementsRef.current.set(id, { element, paragraph });
  }, []);

  const unregisterParagraph = useCallback((id: string) => {
    paragraphElementsRef.current.delete(id);
  }, []);

  const getCharRect = useCallback((chapterIndex: number, paragraphIndex: number, offset: number): DOMRect | null => {
    const para = paragraphs.find(p => p.chapterIndex === chapterIndex && p.paragraphIndex === paragraphIndex);
    if (!para) return null;
    const entry = paragraphElementsRef.current.get(para.id);
    if (!entry) return null;

    const range = document.createRange();
    const textNode = entry.element.firstChild;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return null;

    try {
      range.setStart(textNode, Math.min(offset, textNode.textContent?.length || 0));
      range.setEnd(textNode, Math.min(offset, textNode.textContent?.length || 0));
      const rect = range.getBoundingClientRect();
      range.detach();
      return rect;
    } catch {
      return null;
    }
  }, [paragraphs]);

  const getPositionFromPoint = useCallback((clientX: number, clientY: number): TextPosition | null => {
    let best: { pos: TextPosition; dist: number } | null = null;

    paragraphElementsRef.current.forEach(({ element, paragraph }) => {
      const rect = element.getBoundingClientRect();
      if (clientY < rect.top - 10 || clientY > rect.bottom + 10) return;

      const textNode = element.firstChild;
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;
      const text = textNode.textContent || '';

      let lo = 0;
      let hi = text.length;
      let localBest = 0;
      let localBestDist = Infinity;

      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const range = document.createRange();
        range.setStart(textNode, mid);
        range.setEnd(textNode, mid);
        const r = range.getBoundingClientRect();
        range.detach();
        const dist = Math.hypot(clientX - r.left, clientY - r.top);
        if (dist < localBestDist) {
          localBestDist = dist;
          localBest = mid;
        }
        if (clientX < r.left) hi = mid - 1;
        else lo = mid + 1;
      }

      const checkRange = Math.min(4, text.length);
      for (let i = Math.max(0, localBest - checkRange); i <= Math.min(text.length, localBest + checkRange); i++) {
        const range = document.createRange();
        range.setStart(textNode, i);
        range.setEnd(textNode, i);
        const r = range.getBoundingClientRect();
        range.detach();
        const dist = Math.hypot(clientX - r.left, clientY - r.top);
        if (dist < (best?.dist || Infinity)) {
          best = {
            pos: { chapterIndex: paragraph.chapterIndex, paragraphIndex: paragraph.paragraphIndex, offset: i },
            dist,
          };
        }
      }
    });

    return best?.pos || null;
  }, [paragraphs]);

  const expandToWord = useCallback((text: string, offset: number): [number, number] => {
    const isWordChar = (ch: string) => /[\p{L}\p{N}]/u.test(ch);
    if (offset < 0 || offset >= text.length) return [offset, offset];
    if (!isWordChar(text[offset])) return [offset, offset];
    let s = offset;
    while (s > 0 && isWordChar(text[s - 1])) s--;
    let e = offset;
    while (e < text.length - 1 && isWordChar(text[e + 1])) e++;
    return [s, e];
  }, []);

  const recomputeSelection = useCallback(() => {
    if (!selection) return;
    const { start, end } = selection;
    const rects: SelectionRect[] = [];
    let minTop = Infinity;
    let maxBottom = -Infinity;
    let minLeft = Infinity;
    let maxRight = -Infinity;

    const startPara = paragraphs.find(p => p.chapterIndex === start.chapterIndex && p.paragraphIndex === start.paragraphIndex);
    const endPara = paragraphs.find(p => p.chapterIndex === end.chapterIndex && p.paragraphIndex === end.paragraphIndex);
    if (!startPara || !endPara) return;

    const startEntry = paragraphElementsRef.current.get(startPara.id);
    const endEntry = paragraphElementsRef.current.get(endPara.id);
    if (!startEntry || !endEntry) return;

    const range = document.createRange();
    const startTextNode = startEntry.element.firstChild;
    const endTextNode = endEntry.element.firstChild;
    if (!startTextNode || !endTextNode) return;

    try {
      range.setStart(startTextNode, start.offset);
      range.setEnd(endTextNode, end.offset);

      for (const r of range.getClientRects()) {
        if (r.width === 0 && r.height === 0) continue;
        rects.push({ left: r.left, top: r.top, width: r.width, height: r.height });
        if (r.top < minTop) minTop = r.top;
        if (r.bottom > maxBottom) maxBottom = r.bottom;
        if (r.left < minLeft) minLeft = r.left;
        if (r.right > maxRight) maxRight = r.right;
      }
      range.detach();

      setSelectionRects(rects);

      const startRect = getCharRect(start.chapterIndex, start.paragraphIndex, start.offset);
      const endRect = getCharRect(end.chapterIndex, end.paragraphIndex, end.offset);
      if (startRect && endRect) {
        setHandlePositions({
          start: { x: startRect.left, y: startRect.bottom },
          end: { x: endRect.left + endRect.width, y: endRect.bottom },
        });
      }
    } catch {
      range.detach?.();
    }
  }, [selection, paragraphs, getCharRect]);

  const startSelection = useCallback((clientX: number, clientY: number) => {
    const pos = getPositionFromPoint(clientX, clientY);
    if (!pos) return;

    const para = paragraphs.find(p => p.chapterIndex === pos.chapterIndex && p.paragraphIndex === pos.paragraphIndex);
    if (!para) return;

    const [ws, we] = expandToWord(para.text, pos.offset);
    const newSelection: SelectionRange = {
      start: { ...pos, offset: ws },
      end: { ...pos, offset: we },
    };
    setSelection(newSelection);
    setIsSelecting(true);
    dragHandleRef.current = null;
    recomputeSelection();
  }, [getPositionFromPoint, paragraphs, expandToWord, recomputeSelection]);

  const updateSelectionBoundary = useCallback((which: 'start' | 'end', clientX: number, clientY: number) => {
    if (!selection) return;
    const pos = getPositionFromPoint(clientX, clientY);
    if (!pos) return;

    setSelection(prev => prev ? {
      ...prev,
      [which]: pos,
    } : null);
    recomputeSelection();
  }, [selection, getPositionFromPoint, recomputeSelection]);

  const snapHandleToWord = useCallback((which: 'start' | 'end') => {
    setSelection(prev => {
      if (!prev) return null;
      const pos = prev[which];
      const para = paragraphs.find(p => p.chapterIndex === pos.chapterIndex && p.paragraphIndex === pos.paragraphIndex);
      if (!para) return prev;
      const [ws, we] = expandToWord(para.text, pos.offset);
      return {
        ...prev,
        [which]: { ...pos, offset: which === 'start' ? ws : we },
      };
    });
  }, [paragraphs, expandToWord]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setSelectionRects([]);
    setHandlePositions(null);
    setIsSelecting(false);
    dragHandleRef.current = null;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressArmedRef.current = false;
  }, []);

  const beginHandleDrag = useCallback((which: 'start' | 'end') => {
    if (!selection) return;
    dragHandleRef.current = which;
  }, [selection]);

  const handlePointerMove = useCallback((clientX: number, clientY: number) => {
    if (!dragHandleRef.current || !selection) return;
    updateSelectionBoundary(dragHandleRef.current, clientX, clientY);
  }, [selection, updateSelectionBoundary]);

  const handlePointerUp = useCallback(() => {
    if (dragHandleRef.current) {
      snapHandleToWord(dragHandleRef.current);
      dragHandleRef.current = null;
    }
  }, [snapHandleToWord]);

  const handleLongPress = useCallback((clientX: number, clientY: number) => {
    startSelection(clientX, clientY);
  }, [startSelection]);

  const onDown = useCallback((e: React.PointerEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-selection-toolbar]') || target.closest('[data-selection-handle]')) return;
    if (selection) return;

    const { clientX, clientY } = 'touches' in e
      ? { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }
      : { clientX: e.clientX, clientY: e.clientY };

    longPressArmedRef.current = true;
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      longPressArmedRef.current = false;
      handleLongPress(clientX, clientY);
    }, 400);
  }, [selection, handleLongPress]);

  const onUp = useCallback((e: React.PointerEvent | React.TouchEvent) => {
    const { clientX, clientY } = 'touches' in e
      ? { clientX: e.changedTouches[0]?.clientX || 0, clientY: e.changedTouches[0]?.clientY || 0 }
      : { clientX: e.clientX, clientY: e.clientY };

    const target = e.target as HTMLElement;
    if (target.closest('[data-selection-toolbar]') || target.closest('[data-selection-handle]')) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      longPressArmedRef.current = false;
      return;
    }

    clearSelection();
  }, [clearSelection]);

  useEffect(() => {
    window.addEventListener('pointermove', e => handlePointerMove(e.clientX, e.clientY), { passive: true });
    window.addEventListener('touchmove', e => handlePointerMove(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('touchend', handlePointerUp, { passive: true });
    window.addEventListener('touchcancel', handlePointerUp, { passive: true });
    return () => {
      window.removeEventListener('pointermove', e => handlePointerMove(e.clientX, e.clientY));
      window.removeEventListener('touchmove', e => handlePointerMove(e.touches[0].clientX, e.touches[0].clientY));
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('touchend', handlePointerUp);
      window.removeEventListener('touchcancel', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  useEffect(() => {
    if (selection) recomputeSelection();
  }, [selection, recomputeSelection]);

  return {
    registerParagraph,
    unregisterParagraph,
    selection,
    selectionRects,
    handlePositions,
    isSelecting,
    beginHandleDrag,
    clearSelection,
    onDown,
    onUp,
    getSelectedText: () => {
      if (!selection) return '';
      const { start, end } = selection;
      const startPara = paragraphs.find(p => p.chapterIndex === start.chapterIndex && p.paragraphIndex === start.paragraphIndex);
      const endPara = paragraphs.find(p => p.chapterIndex === end.chapterIndex && p.paragraphIndex === end.paragraphIndex);
      if (!startPara || !endPara) return '';

      if (start.chapterIndex === end.chapterIndex && start.paragraphIndex === end.paragraphIndex) {
        return startPara.text.slice(start.offset, end.offset);
      }

      let text = startPara.text.slice(start.offset);
      for (let ci = start.chapterIndex; ci <= end.chapterIndex; ci++) {
        const startPi = ci === start.chapterIndex ? start.paragraphIndex + 1 : 0;
        const endPi = ci === end.chapterIndex ? end.paragraphIndex : paragraphs.filter(p => p.chapterIndex === ci).length - 1;
        for (let pi = startPi; pi <= endPi; pi++) {
          const p = paragraphs.find(p2 => p2.chapterIndex === ci && p2.paragraphIndex === pi);
          if (p) text += '\n\n' + p.text;
        }
      }
      text += '\n\n' + endPara.text.slice(0, end.offset);
      return text.trim();
    },
  };
}