export interface AppFontConfig {
  headerFont: string;
  bodyFont: string;
}

export const FONT_OPTIONS = {
  header: [
    { name: 'Playfair Display (Classic Serif)', value: '"Playfair Display", Georgia, serif' },
    { name: 'Merriweather (Literary Serif)', value: '"Merriweather", Georgia, serif' },
    { name: 'Cinzel (Majestic Display)', value: '"Cinzel", Georgia, serif' },
    { name: 'Lora (Editorial Serif)', value: '"Lora", Georgia, serif' },
    { name: 'Inter (Modern Sans)', value: '"Inter", sans-serif' },
  ],
  body: [
    { name: 'Plus Jakarta Sans (Clean Modern)', value: '"Plus Jakarta Sans", sans-serif' },
    { name: 'Inter (Versatile Sans)', value: '"Inter", sans-serif' },
    { name: 'Roboto (Standard Sans)', value: '"Roboto", sans-serif' },
    { name: 'Lora (Readable Book Serif)', value: '"Lora", Georgia, serif' },
    { name: 'Open Sans (Neutral)', value: '"Open Sans", sans-serif' },
  ],
};

const FONT_STORAGE_KEY = 'libriaudio_font_config';

export function getSavedFontConfig(): AppFontConfig {
  try {
    const raw = localStorage.getItem(FONT_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to load font config', e);
  }
  return {
    headerFont: '"Playfair Display", Georgia, serif',
    bodyFont: '"Plus Jakarta Sans", sans-serif',
  };
}

export function saveFontConfig(config: AppFontConfig): void {
  try {
    localStorage.setItem(FONT_STORAGE_KEY, JSON.stringify(config));
    applyFontConfig(config);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('libriaudio_font_changed', { detail: config }));
    }
  } catch (e) {
    console.warn('Failed to save font config', e);
  }
}

export function applyFontConfig(config?: AppFontConfig): void {
  if (typeof document === 'undefined') return;
  const cfg = config || getSavedFontConfig();
  document.documentElement.style.setProperty('--font-header', cfg.headerFont);
  document.documentElement.style.setProperty('--font-body', cfg.bodyFont);
}
