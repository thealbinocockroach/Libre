import { registerPlugin } from '@capacitor/core';

const isNative = (): boolean =>
  typeof (window as any).Capacitor?.isNativePlatform === 'function' &&
  !!(window as any).Capacitor?.isNativePlatform?.();

interface TextSelectionPluginDef {
  setBlockNativeSelection(options: { enabled: boolean }): Promise<{ active: boolean }>;
  openDictionary(options: { word: string }): Promise<{ success: boolean }>;
}

const TextSelection = registerPlugin<TextSelectionPluginDef>('TextSelection');

/**
 * Open external dictionary on Android or fallback.
 */
export async function openNativeDictionary(word: string): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const res = await TextSelection.openDictionary({ word });
    return !!res?.success;
  } catch {
    return false;
  }
}

/**
 * Suppress Android's native text-selection ActionMode (the system Copy / Share
 * toolbar) while true. Used by the ebook reader so the host's custom selection menu
 * can be interacted with cleanly without system overlay conflicts.
 */
export async function setBlockNativeSelection(enabled: boolean): Promise<void> {
  if (!isNative()) return;
  try {
    await TextSelection.setBlockNativeSelection({ enabled });
  } catch {
    // non-fatal on device/emulator without the plugin
  }
}

export interface SelectionOffsets {
  start: number;
  end: number;
  text: string;
}

/**
 * Calculate robust character offsets for a DOM Range relative to a root element.
 * Does not depend on specific node types and safely handles nested tags,
 * elements with multiple children, and existing marks.
 */
export function getSelectionOffsets(range: Range, root: HTMLElement): SelectionOffsets | null {
  if (!root || !range) return null;

  try {
    // Ensure the range is within or intersects the root
    if (!root.contains(range.commonAncestorContainer) && root !== range.commonAncestorContainer) {
      return null;
    }

    // Measure pre-start character length
    const preStartRange = document.createRange();
    preStartRange.selectNodeContents(root);
    preStartRange.setEnd(range.startContainer, range.startOffset);
    const start = preStartRange.toString().length;

    // Measure pre-end character length
    const preEndRange = document.createRange();
    preEndRange.selectNodeContents(root);
    preEndRange.setEnd(range.endContainer, range.endOffset);
    const end = preEndRange.toString().length;

    const text = range.toString();

    return {
      start: Math.min(start, end),
      end: Math.max(start, end),
      text,
    };
  } catch (err) {
    console.warn('Failed to calculate selection offsets:', err);
    return null;
  }
}

/**
 * Accurately finds the viewport pixel coordinates (x, y) of the caret at either the
 * 'start' or 'end' boundary of a selection Range.
 * Guarantees that neither handle jumps to (0,0) / top of screen.
 */
export function getRangeBoundaryCaretRect(
  range: Range,
  boundary: 'start' | 'end'
): { x: number; y: number } | null {
  if (!range) return null;
  try {
    const node = boundary === 'start' ? range.startContainer : range.endContainer;
    const offset = boundary === 'start' ? range.startOffset : range.endOffset;

    // 1. If inside a text node, use a 1-character range to guarantee real pixel dimensions
    if (node && node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length || 0;
      const testRange = document.createRange();
      if (boundary === 'start') {
        if (offset < len) {
          testRange.setStart(node, offset);
          testRange.setEnd(node, offset + 1);
          const r = testRange.getBoundingClientRect();
          if (r.height > 0) return { x: r.left, y: r.bottom };
        } else if (offset > 0) {
          testRange.setStart(node, offset - 1);
          testRange.setEnd(node, offset);
          const r = testRange.getBoundingClientRect();
          if (r.height > 0) return { x: r.right, y: r.bottom };
        }
      } else {
        if (offset > 0) {
          testRange.setStart(node, offset - 1);
          testRange.setEnd(node, offset);
          const r = testRange.getBoundingClientRect();
          if (r.height > 0) return { x: r.right, y: r.bottom };
        } else if (offset < len) {
          testRange.setStart(node, offset);
          testRange.setEnd(node, offset + 1);
          const r = testRange.getBoundingClientRect();
          if (r.height > 0) return { x: r.left, y: r.bottom };
        }
      }
    }

    // 2. Collapsed range getClientRects()
    const collapsed = range.cloneRange();
    collapsed.collapse(boundary === 'start');
    const rects = collapsed.getClientRects();
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (r.height > 0 && r.width >= 0) {
        return { x: boundary === 'start' ? r.left : (r.right || r.left), y: r.bottom };
      }
    }

    // 3. Fallback: filter valid non-zero client rects from the full range
    const allRects = Array.from(range.getClientRects()).filter(r => r.width > 0 && r.height > 0);
    if (allRects.length > 0) {
      const target = boundary === 'start' ? allRects[0] : allRects[allRects.length - 1];
      return { x: boundary === 'start' ? target.left : target.right, y: target.bottom };
    }
  } catch {}
  return null;
}

/**
 * Finds the character offset within a text node closest to the given viewport coordinates.
 */
function findTextOffsetAtPoint(textNode: Node, clientX: number, clientY: number): number {
  const text = textNode.textContent || '';
  if (!text) return 0;

  const len = text.length;
  let lo = 0;
  let hi = len;
  let bestOffset = 0;
  let bestDist = Infinity;

  const range = document.createRange();

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    try {
      if (mid < len) {
        range.setStart(textNode, mid);
        range.setEnd(textNode, mid + 1);
      } else {
        range.setStart(textNode, Math.max(0, mid - 1));
        range.setEnd(textNode, mid);
      }
      const rect = range.getBoundingClientRect();
      const centerY = rect.top + (rect.height || 16) / 2;
      const targetX = mid < len ? rect.left : rect.right;
      const dist = Math.hypot(clientX - targetX, clientY - centerY);
      if (dist < bestDist) {
        bestDist = dist;
        bestOffset = mid;
      }
      if (clientY < rect.top || (clientY <= rect.bottom && clientX < rect.left)) {
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    } catch {
      break;
    }
  }

  // Micro-check local neighbors for maximum precision
  const startCheck = Math.max(0, bestOffset - 4);
  const endCheck = Math.min(len, bestOffset + 4);
  for (let i = startCheck; i <= endCheck; i++) {
    try {
      if (i < len) {
        range.setStart(textNode, i);
        range.setEnd(textNode, i + 1);
        const rect = range.getBoundingClientRect();
        const centerY = rect.top + (rect.height || 16) / 2;
        const dist = Math.hypot(clientX - rect.left, clientY - centerY);
        if (dist < bestDist) {
          bestDist = dist;
          bestOffset = i;
        }
      }
    } catch {
      // ignore
    }
  }

  try {
    range.detach?.();
  } catch {
    // ignore
  }

  return Math.max(0, Math.min(bestOffset, len));
}

/**
 * Finds the text node in an element or root that is vertically & horizontally closest to (clientX, clientY).
 */
function findClosestTextNode(root: Node, clientX: number, clientY: number): Node | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let closestNode: Node | null = null;
  let closestDist = Infinity;

  let current = walker.nextNode();
  const range = document.createRange();

  while (current) {
    const text = current.textContent || '';
    if (text.trim().length > 0) {
      try {
        range.selectNodeContents(current);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
          const dy = clientY < rect.top ? rect.top - clientY : (clientY > rect.bottom ? clientY - rect.bottom : 0);
          const dx = clientX < rect.left ? rect.left - clientX : (clientX > rect.right ? clientX - rect.right : 0);
          const dist = dy * 3 + dx;
          if (dist < closestDist) {
            closestDist = dist;
            closestNode = current;
          }
        }
      } catch {
        // ignore
      }
    }
    current = walker.nextNode();
  }

  try {
    range.detach?.();
  } catch {
    // ignore
  }

  return closestNode;
}

export interface CaretPositionResult {
  node: Node;
  offset: number;
}

/**
 * Cross-browser resolution of caret position from viewport (clientX, clientY) coordinates.
 * Safely resolves to leaf text nodes within the optional rootElement.
 * Automatically avoids selection handles and floating menu elements during hit-testing.
 */
export function getCaretPositionFromCoordinates(
  clientX: number,
  clientY: number,
  rootElement?: HTMLElement | null
): CaretPositionResult | null {
  // Temporarily disable pointer events on handles and floating menu to prevent hit test interception
  const handleElements = typeof document !== 'undefined'
    ? (Array.from(document.querySelectorAll('.reader-select-handle, #reader-floating-selection-menu')) as HTMLElement[])
    : [];
  const prevPointers = handleElements.map(el => el.style.pointerEvents);
  handleElements.forEach(el => { el.style.pointerEvents = 'none'; });

  let resolvedNode: Node | null = null;
  let resolvedOffset = 0;

  try {
    // 1. WebKit / Blink caretRangeFromPoint
    if (typeof (document as any).caretRangeFromPoint === 'function') {
      try {
        const range = (document as any).caretRangeFromPoint(clientX, clientY) as Range | null;
        if (range && range.startContainer) {
          resolvedNode = range.startContainer;
          resolvedOffset = range.startOffset;
        }
      } catch {
        // fallback
      }
    }

    // 2. Standard caretPositionFromPoint (Firefox and modern standards)
    if (!resolvedNode && typeof (document as any).caretPositionFromPoint === 'function') {
      try {
        const pos = (document as any).caretPositionFromPoint(clientX, clientY);
        if (pos && pos.offsetNode) {
          resolvedNode = pos.offsetNode;
          resolvedOffset = pos.offset;
        }
      } catch {
        // fallback
      }
    }

    // Validate and normalize native hit result
    if (resolvedNode) {
      if (!rootElement || rootElement.contains(resolvedNode) || rootElement === resolvedNode) {
        if (resolvedNode.nodeType === Node.TEXT_NODE) {
          const textLen = resolvedNode.textContent?.length || 0;
          return {
            node: resolvedNode,
            offset: Math.max(0, Math.min(resolvedOffset, textLen)),
          };
        }

        if (resolvedNode.nodeType === Node.ELEMENT_NODE) {
          const textNode = findClosestTextNode(resolvedNode, clientX, clientY);
          if (textNode) {
            const offset = findTextOffsetAtPoint(textNode, clientX, clientY);
            return { node: textNode, offset };
          }
        }
      }
    }

    // 3. Fallback: Geometric search within rootElement if provided, or element hit test
    const searchRoot = rootElement || (document.elementFromPoint(clientX, clientY) as HTMLElement | null);
    if (searchRoot) {
      const textNode = findClosestTextNode(searchRoot, clientX, clientY);
      if (textNode) {
        const offset = findTextOffsetAtPoint(textNode, clientX, clientY);
        return { node: textNode, offset };
      }
    }

    return null;
  } finally {
    handleElements.forEach((el, idx) => {
      el.style.pointerEvents = prevPointers[idx];
    });
  }
}

/**
 * Safely creates an ordered DOM Range between two boundary points (nodeA, offsetA)
 * and (nodeB, offsetB) regardless of which one precedes the other in the DOM.
 */
export function createOrderedRange(
  nodeA: Node,
  offsetA: number,
  nodeB: Node,
  offsetB: number
): Range {
  const range = document.createRange();

  const maxLenA = nodeA.nodeType === Node.TEXT_NODE ? (nodeA.textContent?.length || 0) : (nodeA.childNodes?.length || 0);
  const maxLenB = nodeB.nodeType === Node.TEXT_NODE ? (nodeB.textContent?.length || 0) : (nodeB.childNodes?.length || 0);
  const safeOffsetA = Math.max(0, Math.min(offsetA, maxLenA));
  const safeOffsetB = Math.max(0, Math.min(offsetB, maxLenB));

  if (nodeA === nodeB) {
    const start = Math.min(safeOffsetA, safeOffsetB);
    const end = Math.max(safeOffsetA, safeOffsetB);
    range.setStart(nodeA, start);
    range.setEnd(nodeA, end);
    return range;
  }

  try {
    const comparison = nodeA.compareDocumentPosition(nodeB);
    if (
      comparison & Node.DOCUMENT_POSITION_FOLLOWING ||
      comparison & Node.DOCUMENT_POSITION_CONTAINED_BY
    ) {
      // nodeA precedes nodeB
      range.setStart(nodeA, safeOffsetA);
      range.setEnd(nodeB, safeOffsetB);
    } else {
      // nodeB precedes nodeA
      range.setStart(nodeB, safeOffsetB);
      range.setEnd(nodeA, safeOffsetA);
    }
  } catch {
    // Fallback: try default order
    try {
      range.setStart(nodeA, safeOffsetA);
      range.setEnd(nodeB, safeOffsetB);
    } catch {
      try {
        range.setStart(nodeB, safeOffsetB);
        range.setEnd(nodeA, safeOffsetA);
      } catch {
        // Return blank range
      }
    }
  }

  return range;
}

/**
 * Finds the word boundary at a given viewport coordinate (clientX, clientY)
 * within an optional root element (e.g. article). Returns a Range covering the word.
 */
export function getWordRangeAtPoint(
  clientX: number,
  clientY: number,
  rootElement?: HTMLElement | null
): Range | null {
  const pos = getCaretPositionFromCoordinates(clientX, clientY);
  if (!pos) return null;

  let textNode: Node | null = pos.node;
  let offset = pos.offset;

  if (rootElement && !rootElement.contains(textNode) && rootElement !== textNode) {
    return null;
  }

  // If pos landed on an element node rather than text node, look for child text node
  if (textNode.nodeType !== Node.TEXT_NODE) {
    const walker = document.createTreeWalker(textNode, NodeFilter.SHOW_TEXT, null);
    const first = walker.nextNode();
    if (first) {
      textNode = first;
      offset = 0;
    } else {
      return null;
    }
  }

  const text = textNode.textContent || '';
  if (!text) return null;

  const boundedOffset = Math.max(0, Math.min(offset, text.length));

  // Match word characters (letters, numbers, apostrophes, underscores, hyphens)
  const isWordChar = (char: string) => /[\p{L}\p{N}_'’\-]/u.test(char);

  let start = boundedOffset;
  let end = boundedOffset;

  // If clicked at boundary between words or after a word
  if (start > 0 && !isWordChar(text[start]) && isWordChar(text[start - 1])) {
    start--;
    end = start;
  }

  // If character at start is a word char, expand in both directions
  if (start < text.length && isWordChar(text[start])) {
    while (start > 0 && isWordChar(text[start - 1])) {
      start--;
    }
    while (end < text.length && isWordChar(text[end])) {
      end++;
    }
  } else {
    // Non-word char (punctuation/symbol), pick single char if available
    end = Math.min(text.length, start + 1);
  }

  if (start >= end) return null;

  try {
    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, end);
    return range;
  } catch {
    return null;
  }
}

/**
 * Safely updates a selection Range boundary without throwing DOMExceptions
 * if a start handle is dragged past the end or vice-versa.
 */
export function updateSelectionRangeSafely(
  currentRange: Range,
  which: 'start' | 'end',
  targetNode: Node,
  targetOffset: number
): Range {
  try {
    if (which === 'start') {
      return createOrderedRange(targetNode, targetOffset, currentRange.endContainer, currentRange.endOffset);
    } else {
      return createOrderedRange(currentRange.startContainer, currentRange.startOffset, targetNode, targetOffset);
    }
  } catch {
    return currentRange;
  }
}

export interface MenuPositionResult {
  x: number;
  y: number;
  placement: 'top' | 'bottom';
}

/**
 * Computes optimal viewport position for the floating toolbar, ensuring it never
 * goes offscreen on mobile phones or hides behind top reader headers.
 */
export function calculateMenuPosition(
  rect: DOMRect,
  menuWidth = 320,
  menuHeight = 46,
  padding = 10
): MenuPositionResult {
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 400;
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  // Center horizontally over selection
  let x = rect.left + rect.width / 2 - menuWidth / 2;
  x = Math.max(padding, Math.min(windowWidth - menuWidth - padding, x));

  // Determine top vs bottom placement
  let y = rect.top - menuHeight - 14;
  let placement: 'top' | 'bottom' = 'top';

  // If too close to the top header (e.g. y < 65px), place below selection
  if (y < 65) {
    y = Math.min(windowHeight - menuHeight - padding, rect.bottom + 52);
    placement = 'bottom';
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    placement,
  };
}
