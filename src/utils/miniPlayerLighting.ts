import { useEffect, useState } from 'react';

export const MINI_LIGHTING_STORAGE_KEY = 'libriaudio_mini_lighting';
export const MINI_LIGHTING_CHANGED_EVENT = 'libriaudio-mini-lighting-changed';

export function getSavedMiniLighting(): boolean {
  try {
    const saved = localStorage.getItem(MINI_LIGHTING_STORAGE_KEY);
    if (saved !== null) return saved === 'on';
  } catch (e) {}
  return false;
}

export function saveMiniLighting(enabled: boolean): void {
  try {
    localStorage.setItem(MINI_LIGHTING_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch (e) {}
  window.dispatchEvent(
    new CustomEvent(MINI_LIGHTING_CHANGED_EVENT, { detail: { enabled } })
  );
}

export function useMiniLighting(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => getSavedMiniLighting());

  useEffect(() => {
    const handler = (e: Event) => {
      const next = (e as CustomEvent).detail?.enabled;
      if (typeof next === 'boolean') setEnabled(next);
    };
    window.addEventListener(MINI_LIGHTING_CHANGED_EVENT, handler);
    return () => window.removeEventListener(MINI_LIGHTING_CHANGED_EVENT, handler);
  }, []);

  return enabled;
}

// In-memory cache so cover images are only sampled once
const coverColorCache = new Map<string, string | null>();

export function extractCoverColor(imageUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (!imageUrl) return resolve(null);
    if (coverColorCache.has(imageUrl)) {
      return resolve(coverColorCache.get(imageUrl) ?? null);
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';

    const finalize = (result: string | null) => {
      coverColorCache.set(imageUrl, result);
      resolve(result);
    };

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        if (!ctx) return finalize(null);
        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;

        let bestR = 0, bestG = 0, bestB = 0;
        let bestSaturation = -1;
        let sumR = 0, sumG = 0, sumB = 0, count = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a < 128) continue;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const lum = (max + min) / 2;
          if (lum < 25 || lum > 235) continue;

          const sat = max === 0 ? 0 : (max - min) / max;
          if (sat > bestSaturation) {
            bestSaturation = sat;
            bestR = r;
            bestG = g;
            bestB = b;
          }

          sumR += r;
          sumG += g;
          sumB += b;
          count++;
        }

        if (bestSaturation > 0.25) {
          finalize(`${bestR}, ${bestG}, ${bestB}`);
        } else if (count > 0) {
          finalize(`${Math.round(sumR / count)}, ${Math.round(sumG / count)}, ${Math.round(sumB / count)}`);
        } else {
          finalize(null);
        }
      } catch (e) {
        finalize(null);
      }
    };

    img.onerror = () => finalize(null);
    img.src = imageUrl;
  });
}
