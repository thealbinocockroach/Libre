import { Capacitor } from '@capacitor/core';

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
 * dictionary, etc.) instead of the in-app sidebar lookup.
 */
export async function launchExternalDictionary(rawText: string): Promise<boolean> {
  const word = extractLookupWord(rawText);
  if (!word) return false;

  const platform = getPlatform();

  if (isNative() && platform === 'android') {
    const encoded = encodeURIComponent(word);
    const intents = [
      // WordWeb (if installed)
      `intent:#Intent;action=android.intent.action.SEND;type=text/plain;S.android.intent.extra.TEXT=${encoded};package=com.wordwebsoftware.android.wordweb;end`,
      // GoldenDict
      `intent:#Intent;action=android.intent.action.VIEW;S.EXTRA_QUERY=${encoded};package=mobi.goldendict.android;end`,
      // System "define" / any app that handles PROCESS_TEXT
      `intent:#Intent;action=android.intent.action.PROCESS_TEXT;type=text/plain;S.android.intent.extra.PROCESS_TEXT=${encoded};end`,
      // Generic web search intent fallback
      `intent://search?q=define+${encoded}#Intent;scheme=https;package=com.android.chrome;end`,
    ];

    for (const intentUrl of intents) {
      try {
        window.location.href = intentUrl;
        return true;
      } catch {
        // try next intent
      }
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
