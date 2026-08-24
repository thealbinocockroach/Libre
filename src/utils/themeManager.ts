export type ThemeId =
  | 'midnight-gold'
  | 'oled-black'
  | 'warm-sepia'
  | 'forest-slate'
  | 'crimson-velvet'
  | 'paper-light'
  | 'smart-adaptive';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  subtitle: string;
  category: 'dark' | 'light' | 'adaptive';
  colors: {
    bg: string;
    surface: string;
    surfaceRaised: string;
    accent: string;
    accentHover: string;
    accentDim: string;
    textMain: string;
    textDim: string;
    border: string;
  };
  previewColors: [string, string, string]; // [bg, surface, accent]
}

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
      textMain: '#EFEFEF',
      textDim: '#888888',
      border: 'rgba(255, 255, 255, 0.08)',
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
      textMain: '#F5F5F5',
      textDim: '#7A7A7A',
      border: 'rgba(255, 255, 255, 0.06)',
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
      textMain: '#EADBCA',
      textDim: '#A89988',
      border: 'rgba(212, 155, 80, 0.12)',
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
      textMain: '#E2EFEA',
      textDim: '#7D9E93',
      border: 'rgba(78, 186, 136, 0.12)',
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
      textMain: '#F2EAE9',
      textDim: '#A08892',
      border: 'rgba(224, 122, 95, 0.12)',
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
      accentHover: '#734e0e',
      accentDim: 'rgba(140, 96, 22, 0.15)',
      textMain: '#1A1713',
      textDim: '#5C5449',
      border: 'rgba(0, 0, 0, 0.1)',
    },
    previewColors: ['#F7F4EC', '#EAE4D7', '#8C6016'],
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
      textMain: '#EFEFEF',
      textDim: '#888888',
      border: 'rgba(255, 255, 255, 0.08)',
    },
    previewColors: ['#F7F4EC', '#D49B50', '#050505'],
  },
};

const THEME_STORAGE_KEY = 'libriaudio_theme_preference';

/**
 * Determine the resolved active theme when in Smart Adaptive mode
 */
export function getSmartAdaptiveResolvedTheme(): ThemeId {
  const hour = new Date().getHours();
  // 07:00 to 17:30 -> Daytime editorial cream or sepia depending on system
  if (hour >= 7 && hour < 17) {
    return 'paper-light';
  }
  // 17:00 to 21:30 -> Cozy warm sepia evening
  if (hour >= 17 && hour < 22) {
    return 'warm-sepia';
  }
  // 22:00 to 07:00 -> Midnight Gold / OLED
  return 'midnight-gold';
}

/**
 * Apply CSS variables to document root
 */
export function applyThemeToDOM(themeId: ThemeId): ThemeDefinition {
  const root = document.documentElement;
  const isAdaptive = themeId === 'smart-adaptive';
  const resolvedId = isAdaptive ? getSmartAdaptiveResolvedTheme() : themeId;
  const themeDef = THEMES[resolvedId] || THEMES['midnight-gold'];

  // Set CSS variables
  root.style.setProperty('--bg', themeDef.colors.bg);
  root.style.setProperty('--surface', themeDef.colors.surface);
  root.style.setProperty('--surface-raised', themeDef.colors.surfaceRaised);
  root.style.setProperty('--accent', themeDef.colors.accent);
  root.style.setProperty('--accent-hover', themeDef.colors.accentHover);
  root.style.setProperty('--accent-dim', themeDef.colors.accentDim);
  root.style.setProperty('--text-main', themeDef.colors.textMain);
  root.style.setProperty('--text-dim', themeDef.colors.textDim);
  root.style.setProperty('--border-subtle', themeDef.colors.border);

  // Set data attribute for conditional styling
  root.setAttribute('data-theme', themeId);
  root.setAttribute('data-resolved-theme', resolvedId);
  root.setAttribute('data-theme-category', themeDef.category);

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
  let saved: ThemeId = 'midnight-gold';
  try {
    const item = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId;
    if (item && THEMES[item]) {
      saved = item;
    }
  } catch (e) {}

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
  return 'midnight-gold';
}
