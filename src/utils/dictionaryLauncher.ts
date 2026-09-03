import { Capacitor } from '@capacitor/core';
import { openNativeDictionary } from './textSelection';

const isNative = (): boolean =>
  typeof (window as any).Capacitor?.isNativePlatform === 'function' &&
  !!(window as any).Capacitor?.isNativePlatform?.();

const getPlatform = (): string =>
  typeof Capacitor?.getPlatform === 'function' ? Capacitor.getPlatform() : 'web';

/**
 * Extract the first dictionary-worthy word from a text selection.
 */
export function extractLookupWord(text: string): string {
  const match = text.trim().match(/[a-zA-Z][a-zA-Z'-]*/);
  return match ? match[0].toLowerCase() : '';
}

/**
 * Open the selected word in an external dictionary app (WordWeb, system
 * dictionary, etc.) with instant, lag-free return back to the reader.
 */
export async function launchExternalDictionary(rawText: string): Promise<boolean> {
  const word = extractLookupWord(rawText);
  if (!word) return false;

  const platform = getPlatform();

  if (isNative() && platform === 'android') {
    try {
      const opened = await openNativeDictionary(word);
      if (opened) return true;
    } catch {
      // fallback
    }
  }

  if (isNative() && platform === 'ios') {
    const dictUrl = `dict://${encodeURIComponent(word)}`;
    try {
      window.location.href = dictUrl;
      return true;
    } catch {
      window.open(
        `https://www.merriam-webster.com/dictionary/${encodeURIComponent(word)}`,
        '_blank',
        'noopener',
      );
      return true;
    }
  }

  window.open(`https://www.google.com/search?q=define+${encodeURIComponent(word)}`, '_blank', 'noopener');
  return true;
}
