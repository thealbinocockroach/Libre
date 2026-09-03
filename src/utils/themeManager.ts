export type ThemeId =
  | 'midnight-gold'
  | 'oled-black'
  | 'warm-sepia'
  | 'forest-slate'
  | 'crimson-velvet'
  | 'paper-light'
  | 'slate-mono'
  | 'ocean-depths'
  | 'smart-adaptive'
  | 'custom';

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceRaised: string;
  accent: string;
  accentHover: string;
  accentDim: string;
  accentRgb: string;
  textMain: string;
  textDim: string;
  border: string;
  onAccent: string;
  success: string;
  successDim: string;
  warning: string;
  warningDim: string;
  danger: string;
  dangerDim: string;
  overlay: string;
  scrollbar: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  subtitle: string;
  category: 'dark' | 'light' | 'adaptive' | 'custom';
  colors: ThemeColors;
  previewColors: [string, string, string]; // [bg, surface, accent]
}

/* ------------------------------------------------------------------ *
 * Color helpers (used to derive companion values for custom themes)
 * ------------------------------------------------------------------ */

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const int = parseInt(h, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [clampByte(r), clampByte(g), clampByte(b)]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
  );
}

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function isLight(hex: string): boolean {
  return luminance(hex) > 0.5;
}

function shade(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  return rgbToHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
}

function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function rgbString(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `${r}, ${g}, ${b}`;
}

/**
 * Build a full ThemeColors object from the essential user-picked values.
 * The custom theme editor only asks for bg / surface / accent / textMain;
 * everything else is derived for cohesion on the player and menus alike.
 */
export function buildCustomColors(input: {
  bg: string;
  surface: string;
  accent: string;
  textMain: string;
}): ThemeColors {
  const { bg, surface, accent, textMain } = input;
  const light = isLight(bg);
  const surfaceRaised = light ? shade(surface, -10) : shade(surface, 14);
  const accentHover = isLight(accent) ? shade(accent, -14) : shade(accent, 16);
  const accentDim = withAlpha(accent, 0.15);
  const textDim = withAlpha(textMain, light ? 0.55 : 0.52);
  const border = light ? 'rgba(0, 0, 0, 0.10)' : 'rgba(255, 255, 255, 0.10)';
  const onAccent = isLight(accent) ? '#111111' : '#FFFFFF';

  return {
    bg,
    surface,
    surfaceRaised,
    accent,
    accentHover,
    accentDim,
    accentRgb: rgbString(accent),
    textMain,
    textDim,
    border,
    onAccent,
    success: light ? '#15803D' : '#4ADE80',
    successDim: light ? 'rgba(21, 128, 61, 0.14)' : 'rgba(74, 222, 128, 0.16)',
    warning: light ? '#B45309' : '#FBBF24',
    warningDim: light ? 'rgba(180, 83, 9, 0.14)' : 'rgba(251, 191, 36, 0.16)',
    danger: light ? '#B91C1C' : '#F87171',
    dangerDim: light ? 'rgba(185, 28, 28, 0.14)' : 'rgba(248, 113, 113, 0.16)',
    overlay: light ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0.85)',
    scrollbar: light ? 'rgba(0, 0, 0, 0.18)' : 'rgba(255, 255, 255, 0.18)',
  };
}

/* ------------------------------------------------------------------ *
 * Built-in themes
 * ------------------------------------------------------------------ */

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  'midnight-gold': {
    id: 'midnight-gold',
    name: 'Midnight Gold',
    subtitle: 'Classic LibriVox obsidian with warm gold accents',
    category: 'dark',
    colors: {
      bg: '#050505',
      surface: '#111111',
      surfaceRaised: '#181818',
      accent: '#C5A059',
      accentHover: '#d4af65',
      accentDim: 'rgba(197, 160, 89, 0.15)',
      accentRgb: '197, 160, 89',
      textMain: '#EFEFEF',
      textDim: '#888888',
      border: 'rgba(255, 255, 255, 0.08)',
      onAccent: '#0A0A0A',
      success: '#4ADE80',
      successDim: 'rgba(74, 222, 128, 0.16)',
      warning: '#FBBF24',
      warningDim: 'rgba(251, 191, 36, 0.16)',
      danger: '#F87171',
      dangerDim: 'rgba(248, 113, 113, 0.16)',
      overlay: 'rgba(0, 0, 0, 0.85)',
      scrollbar: 'rgba(255, 255, 255, 0.18)',
    },
    previewColors: ['#050505', '#141414', '#C5A059'],
  },
  'oled-black': {
    id: 'oled-black',
    name: 'OLED Pure Black',
    subtitle: 'Battery-saving pitch black with vibrant amber glow',
    category: 'dark',
    colors: {
      bg: '#000000',
      surface: '#0a0a0a',
      surfaceRaised: '#121212',
      accent: '#E5A93C',
      accentHover: '#f5ba4f',
      accentDim: 'rgba(229, 169, 60, 0.15)',
      accentRgb: '229, 169, 60',
      textMain: '#F5F5F5',
      textDim: '#7A7A7A',
      border: 'rgba(255, 255, 255, 0.06)',
      onAccent: '#000000',
      success: '#34D399',
      successDim: 'rgba(52, 211, 153, 0.16)',
      warning: '#F59E0B',
      warningDim: 'rgba(245, 158, 11, 0.16)',
      danger: '#FB7185',
      dangerDim: 'rgba(251, 113, 133, 0.16)',
      overlay: 'rgba(0, 0, 0, 0.9)',
      scrollbar: 'rgba(255, 255, 255, 0.15)',
    },
    previewColors: ['#000000', '#0f0f0f', '#E5A93C'],
  },
  'warm-sepia': {
    id: 'warm-sepia',
    name: 'Antique Sepia',
    subtitle: 'Cozy book lover palette with parchment tones',
    category: 'dark',
    colors: {
      bg: '#14100c',
      surface: '#1e1812',
      surfaceRaised: '#282119',
      accent: '#D49B50',
      accentHover: '#e0aa64',
      accentDim: 'rgba(212, 155, 80, 0.15)',
      accentRgb: '212, 155, 80',
      textMain: '#EADBCA',
      textDim: '#A89988',
      border: 'rgba(212, 155, 80, 0.12)',
      onAccent: '#14100C',
      success: '#6EE7B7',
      successDim: 'rgba(110, 231, 183, 0.16)',
      warning: '#FCD34D',
      warningDim: 'rgba(252, 211, 77, 0.16)',
      danger: '#FCA5A5',
      dangerDim: 'rgba(252, 165, 165, 0.16)',
      overlay: 'rgba(20, 16, 12, 0.85)',
      scrollbar: 'rgba(234, 219, 202, 0.22)',
    },
    previewColors: ['#14100c', '#201913', '#D49B50'],
  },
  'forest-slate': {
    id: 'forest-slate',
    name: 'Nordic Pine',
    subtitle: 'Calm evergreen and deep twilight atmosphere',
    category: 'dark',
    colors: {
      bg: '#080f0f',
      surface: '#0f1b1b',
      surfaceRaised: '#172727',
      accent: '#4EBA88',
      accentHover: '#62cfa0',
      accentDim: 'rgba(78, 186, 136, 0.15)',
      accentRgb: '78, 186, 136',
      textMain: '#E2EFEA',
      textDim: '#7D9E93',
      border: 'rgba(78, 186, 136, 0.12)',
      onAccent: '#06231A',
      success: '#6EE7B7',
      successDim: 'rgba(110, 231, 183, 0.16)',
      warning: '#FBBF24',
      warningDim: 'rgba(251, 191, 36, 0.16)',
      danger: '#F87171',
      dangerDim: 'rgba(248, 113, 113, 0.16)',
      overlay: 'rgba(4, 12, 12, 0.85)',
      scrollbar: 'rgba(226, 239, 234, 0.18)',
    },
    previewColors: ['#080f0f', '#122020', '#4EBA88'],
  },
  'crimson-velvet': {
    id: 'crimson-velvet',
    name: 'Royal Velvet',
    subtitle: 'Rich dark plum and warm terracotta gold',
    category: 'dark',
    colors: {
      bg: '#0f090d',
      surface: '#1b1017',
      surfaceRaised: '#261621',
      accent: '#E07A5F',
      accentHover: '#e88e76',
      accentDim: 'rgba(224, 122, 95, 0.15)',
      accentRgb: '224, 122, 95',
      textMain: '#F2EAE9',
      textDim: '#A08892',
      border: 'rgba(224, 122, 95, 0.12)',
      onAccent: '#1A0D12',
      success: '#86EFAC',
      successDim: 'rgba(134, 239, 172, 0.16)',
      warning: '#FCD34D',
      warningDim: 'rgba(252, 211, 77, 0.16)',
      danger: '#FDA4AF',
      dangerDim: 'rgba(253, 164, 175, 0.16)',
      overlay: 'rgba(15, 9, 13, 0.88)',
      scrollbar: 'rgba(242, 234, 233, 0.18)',
    },
    previewColors: ['#0f090d', '#1e111a', '#E07A5F'],
  },
  'paper-light': {
    id: 'paper-light',
    name: 'Editorial Cream',
    subtitle: 'Crisp, high-contrast daylight reading paper',
    category: 'light',
    colors: {
      bg: '#F7F4EC',
      surface: '#EAE4D7',
      surfaceRaised: '#DCD4C4',
      accent: '#8C6016',
      accentHover: '#a87628',
      accentDim: 'rgba(140, 96, 22, 0.14)',
      accentRgb: '140, 96, 22',
      textMain: '#1A1713',
      textDim: '#5C5449',
      border: 'rgba(0, 0, 0, 0.1)',
      onAccent: '#FFFFFF',
      success: '#15803D',
      successDim: 'rgba(21, 128, 61, 0.14)',
      warning: '#B45309',
      warningDim: 'rgba(180, 83, 9, 0.14)',
      danger: '#B91C1C',
      dangerDim: 'rgba(185, 28, 28, 0.14)',
      overlay: 'rgba(0, 0, 0, 0.55)',
      scrollbar: 'rgba(0, 0, 0, 0.18)',
    },
    previewColors: ['#F7F4EC', '#EAE4D7', '#8C6016'],
  },
  'slate-mono': {
    id: 'slate-mono',
    name: 'Slate Mono',
    subtitle: 'Cool neutral slate with muted steel accents',
    category: 'dark',
    colors: {
      bg: '#0C0E10',
      surface: '#181C20',
      surfaceRaised: '#1F2429',
      accent: '#94A3B8',
      accentHover: '#A8B8CC',
      accentDim: 'rgba(148, 163, 184, 0.15)',
      accentRgb: '148, 163, 184',
      textMain: '#F1F5F9',
      textDim: '#8494A7',
      border: 'rgba(255, 255, 255, 0.08)',
      onAccent: '#0C0E10',
      success: '#4ADE80',
      successDim: 'rgba(74, 222, 128, 0.16)',
      warning: '#FBBF24',
      warningDim: 'rgba(251, 191, 36, 0.16)',
      danger: '#F87171',
      dangerDim: 'rgba(248, 113, 113, 0.16)',
      overlay: 'rgba(0, 0, 0, 0.85)',
      scrollbar: 'rgba(255, 255, 255, 0.18)',
    },
    previewColors: ['#0C0E10', '#181C20', '#94A3B8'],
  },
  'ocean-depths': {
    id: 'ocean-depths',
    name: 'Ocean Depths',
    subtitle: 'Deep sea blue with cool cyan highlights',
    category: 'dark',
    colors: {
      bg: '#060d18',
      surface: '#0c1825',
      surfaceRaised: '#112033',
      accent: '#38BDF8',
      accentHover: '#5CCDF9',
      accentDim: 'rgba(56, 189, 248, 0.15)',
      accentRgb: '56, 189, 248',
      textMain: '#E0F0FF',
      textDim: '#7AA3C8',
      border: 'rgba(255, 255, 255, 0.08)',
      onAccent: '#060d18',
      success: '#4ADE80',
      successDim: 'rgba(74, 222, 128, 0.16)',
      warning: '#FBBF24',
      warningDim: 'rgba(251, 191, 36, 0.16)',
      danger: '#F87171',
      dangerDim: 'rgba(248, 113, 113, 0.16)',
      overlay: 'rgba(0, 0, 0, 0.85)',
      scrollbar: 'rgba(255, 255, 255, 0.18)',
    },
    previewColors: ['#060d18', '#0c1825', '#38BDF8'],
  },
  'smart-adaptive': {
    id: 'smart-adaptive',
    name: 'Smart Adaptive',
    subtitle: 'Auto-adapts with time of day: Day Cream ➔ Sepia Sunset ➔ Midnight Gold',
    category: 'adaptive',
    colors: {
      bg: '#050505',
      surface: '#111111',
      surfaceRaised: '#181818',
      accent: '#C5A059',
      accentHover: '#d4af65',
      accentDim: 'rgba(197, 160, 89, 0.15)',
      accentRgb: '197, 160, 89',
      textMain: '#EFEFEF',
      textDim: '#888888',
      border: 'rgba(255, 255, 255, 0.08)',
      onAccent: '#0A0A0A',
      success: '#4ADE80',
      successDim: 'rgba(74, 222, 128, 0.16)',
      warning: '#FBBF24',
      warningDim: 'rgba(251, 191, 36, 0.16)',
      danger: '#F87171',
      dangerDim: 'rgba(248, 113, 113, 0.16)',
      overlay: 'rgba(0, 0, 0, 0.85)',
      scrollbar: 'rgba(255, 255, 255, 0.18)',
    },
    previewColors: ['#F7F4EC', '#D49B50', '#050505'],
  },
  'custom': {
    id: 'custom',
    name: 'Custom',
    subtitle: 'Your own colors, applied app-wide including the player',
    category: 'custom',
    colors: buildCustomColors({
      bg: '#050505',
      surface: '#111111',
      accent: '#C5A059',
      textMain: '#EFEFEF',
    }),
    previewColors: ['#050505', '#111111', '#C5A059'],
  },
};

const THEME_STORAGE_KEY = 'libriaudio_theme_preference';
const CUSTOM_THEME_KEY = 'libriaudio_custom_theme';

export interface CustomThemeInput {
  bg: string;
  surface: string;
  accent: string;
  textMain: string;
}

/* ------------------------------------------------------------------ *
 * Custom theme persistence
 * ------------------------------------------------------------------ */

export function getSavedCustomTheme(): CustomThemeInput {
  const fallback: CustomThemeInput = {
    bg: '#050505',
    surface: '#111111',
    accent: '#C5A059',
    textMain: '#EFEFEF',
  };
  try {
    const raw = localStorage.getItem(CUSTOM_THEME_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        bg: parsed.bg || fallback.bg,
        surface: parsed.surface || fallback.surface,
        accent: parsed.accent || fallback.accent,
        textMain: parsed.textMain || fallback.textMain,
      };
    }
  } catch (e) {
    // ignore
  }
  return fallback;
}

export function saveCustomThemeColors(input: CustomThemeInput): void {
  try {
    localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(input));
  } catch (e) {
    // ignore
  }
  // Rebuild the cached custom definition from the new colors
  THEMES['custom'] = {
    ...THEMES['custom'],
    colors: buildCustomColors(input),
    category: isLight(input.bg) ? 'light' : 'dark',
    previewColors: [input.bg, input.surface, input.accent],
  };
}

/**
 * Live-preview custom colors on the DOM without persisting them.
 * Used by the color editor so changes appear immediately.
 */
export function previewCustomTheme(input: CustomThemeInput): void {
  THEMES['custom'] = {
    ...THEMES['custom'],
    colors: buildCustomColors(input),
    category: isLight(input.bg) ? 'light' : 'dark',
    previewColors: [input.bg, input.surface, input.accent],
  };
  applyThemeToDOM('custom');
}

/**
 * Return the effective ThemeDefinition for a given selection, resolving
 * adaptive and custom selectors to the concrete colors to apply.
 */
export function resolveThemeDef(themeId: ThemeId): ThemeDefinition {
  if (themeId === 'custom') {
    // Use the cached custom definition (kept in sync by save/preview helpers).
    // It is initialized from persisted colors in initTheme().
    return THEMES['custom'];
  }
  if (themeId === 'smart-adaptive') {
    const resolved = getSmartAdaptiveResolvedTheme();
    return THEMES[resolved] || THEMES['slate-mono'];
  }
  return THEMES[themeId] || THEMES['slate-mono'];
}

/**
 * Determine the resolved active theme when in Smart Adaptive mode
 */
export function getSmartAdaptiveResolvedTheme(): ThemeId {
  const hour = new Date().getHours();
  // 07:00 to 17:00 -> Daytime editorial cream
  if (hour >= 7 && hour < 17) {
    return 'paper-light';
  }
  // 17:00 to 21:00 -> Cozy warm sepia evening
  if (hour >= 17 && hour < 21) {
    return 'warm-sepia';
  }
  // 21:00 to 07:00 -> Midnight Gold / OLED
  return 'slate-mono';
}

/**
 * Apply CSS variables to document root
 */
export function applyThemeToDOM(themeId: ThemeId): ThemeDefinition {
  const root = document.documentElement;
  const themeDef = resolveThemeDef(themeId);
  const resolvedId =
    themeId === 'smart-adaptive' ? getSmartAdaptiveResolvedTheme() : themeId;

  const c = themeDef.colors;
  root.style.setProperty('--bg', c.bg);
  root.style.setProperty('--surface', c.surface);
  root.style.setProperty('--surface-raised', c.surfaceRaised);
  root.style.setProperty('--accent', c.accent);
  root.style.setProperty('--accent-hover', c.accentHover);
  root.style.setProperty('--accent-dim', c.accentDim);
  root.style.setProperty('--accent-rgb', c.accentRgb);
  root.style.setProperty('--text-main', c.textMain);
  root.style.setProperty('--text-dim', c.textDim);
  root.style.setProperty('--border-subtle', c.border);
  root.style.setProperty('--on-accent', c.onAccent);
  root.style.setProperty('--success', c.success);
  root.style.setProperty('--success-dim', c.successDim);
  root.style.setProperty('--warning', c.warning);
  root.style.setProperty('--warning-dim', c.warningDim);
  root.style.setProperty('--danger', c.danger);
  root.style.setProperty('--danger-dim', c.dangerDim);
  root.style.setProperty('--overlay', c.overlay);
  root.style.setProperty('--scrollbar', c.scrollbar);

  root.setAttribute('data-theme', themeId);
  root.setAttribute('data-resolved-theme', resolvedId);
  root.setAttribute('data-theme-category', themeDef.category === 'light' ? 'light' : 'dark');

  if (themeDef.category === 'light') {
    root.classList.add('theme-light');
    root.classList.remove('theme-dark');
  } else {
    root.classList.add('theme-dark');
    root.classList.remove('theme-light');
  }

  return themeDef;
}

let adaptiveTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Initialize theme from localStorage and attach interval listener for smart adaptive
 */
export function initTheme(): ThemeId {
  let saved: ThemeId = 'slate-mono';
  try {
    const item = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId;
    if (item && THEMES[item]) {
      saved = item;
    }
  } catch (e) {}

  // Make sure a custom definition exists before applying
  if (saved === 'custom') {
    saveCustomThemeColors(getSavedCustomTheme());
  }

  applyThemeToDOM(saved);

  // Start smart adaptive interval checker if needed
  if (saved === 'smart-adaptive' && !adaptiveTimer) {
    adaptiveTimer = setInterval(() => {
      applyThemeToDOM('smart-adaptive');
    }, 60000); // check every minute
  }

  return saved;
}

/**
 * Save and apply theme
 */
export function saveThemePreference(themeId: ThemeId): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch (e) {}

  applyThemeToDOM(themeId);

  // Manage adaptive timer
  if (adaptiveTimer) {
    clearInterval(adaptiveTimer);
    adaptiveTimer = null;
  }
  if (themeId === 'smart-adaptive') {
    adaptiveTimer = setInterval(() => {
      applyThemeToDOM('smart-adaptive');
    }, 60000);
  }

  // Dispatch custom event for reactive components
  window.dispatchEvent(new CustomEvent('libriaudio-theme-changed', { detail: { themeId } }));
}

/**
 * Get current saved theme ID
 */
export function getSavedTheme(): ThemeId {
  try {
    const item = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId;
    if (item && THEMES[item]) return item;
  } catch (e) {}
  return 'slate-mono';
}
