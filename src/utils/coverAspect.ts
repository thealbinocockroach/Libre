import { useEffect, useState } from 'react';

export type CoverAspect = '1:1' | '3:4';

export const COVER_ASPECT_STORAGE_KEY = 'libriaudio_cover_aspect_ratio';
export const DEFAULT_COVER_ASPECT: CoverAspect = '1:1';

const COVER_ASPECT_CHANGED_EVENT = 'libriaudio-cover-aspect-changed';

const ASPECT_CLASS_MAP: Record<CoverAspect, string> = {
  '1:1': 'aspect-square',
  '3:4': 'aspect-[3/4]',
};

export function getSavedCoverAspect(): CoverAspect {
  try {
    const saved = localStorage.getItem(COVER_ASPECT_STORAGE_KEY);
    if (saved === '1:1' || saved === '3:4') return saved;
  } catch (e) {}
  return DEFAULT_COVER_ASPECT;
}

export function saveCoverAspect(aspect: CoverAspect): void {
  try {
    localStorage.setItem(COVER_ASPECT_STORAGE_KEY, aspect);
  } catch (e) {}
  window.dispatchEvent(
    new CustomEvent(COVER_ASPECT_CHANGED_EVENT, { detail: { aspect } })
  );
}

export function getCoverAspectClass(aspect: CoverAspect): string {
  return ASPECT_CLASS_MAP[aspect] || ASPECT_CLASS_MAP[DEFAULT_COVER_ASPECT];
}

export function getSavedCoverAspectClass(): string {
  return getCoverAspectClass(getSavedCoverAspect());
}

export function useCoverAspect(): CoverAspect {
  const [aspect, setAspect] = useState<CoverAspect>(() => getSavedCoverAspect());

  useEffect(() => {
    const handler = (e: Event) => {
      const next = (e as CustomEvent).detail?.aspect;
      if (next === '1:1' || next === '3:4') setAspect(next);
    };
    window.addEventListener(COVER_ASPECT_CHANGED_EVENT, handler);
    return () => window.removeEventListener(COVER_ASPECT_CHANGED_EVENT, handler);
  }, []);

  return aspect;
}