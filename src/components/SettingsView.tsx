import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  Settings,
  Save,
  Check,
  Maximize2,
  Minimize2,
  Palette,
  Target,
  Clock,
  Sparkles,
  Flame,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  Headphones,
  Sliders,
  Radio,
  Type,
} from 'lucide-react';
import {
  isCurrentlyFullscreen,
  toggleFullscreenMode,
  requestFullscreenMode,
} from '../utils/fullscreenHelper';
import {
  THEMES,
  ThemeId,
  getSavedTheme,
  saveThemePreference,
  getSmartAdaptiveResolvedTheme,
  getSavedCustomTheme,
  saveCustomThemeColors,
  previewCustomTheme,
  CustomThemeInput,
} from '../utils/themeManager';
import {
  getDailyGoalMinutes,
  setDailyGoalMinutes,
  GOAL_PRESETS,
  getTodayGoalProgress,
} from '../utils/goalTracker';
import {
  AudioQualityPreference,
  getSavedQualityPreference,
  saveQualityPreference,
  QUALITY_CONFIGS,
} from '../utils/audioQualityManager';
import {
  getSavedFontConfig,
  saveFontConfig,
  FONT_OPTIONS,
  AppFontConfig,
} from '../utils/fontManager';
import { ColorPickerPanel } from './ColorPickerPanel';
import { PALETTE_PRESETS } from '../utils/colorPickerUtils';

interface SettingsViewProps {
  onUploadEpub?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onUploadEpub }) => {
  const [name, setName] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(isCurrentlyFullscreen());
  const [autoFullscreen, setAutoFullscreen] = useState(true);

  // Audio Quality Preference
  const [selectedQuality, setSelectedQuality] = useState<AudioQualityPreference>(
    getSavedQualityPreference()
  );
  const [qualitySavedNotification, setQualitySavedNotification] = useState(false);

  // Theme state (collapsible, collapsed by default)
  const [isThemeExpanded, setIsThemeExpanded] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(getSavedTheme());
  const [resolvedAdaptiveTheme, setResolvedAdaptiveTheme] = useState<ThemeId>(
    getSmartAdaptiveResolvedTheme()
  );

  // Custom theme color editor
  const [customColors, setCustomColors] = useState<CustomThemeInput>(getSavedCustomTheme());
  const [customSavedNote, setCustomSavedNote] = useState(false);
  const [isCustomEditorOpen, setIsCustomEditorOpen] = useState(false);
  const [editingColorField, setEditingColorField] = useState<keyof CustomThemeInput | null>(null);

  // Font customization state
  const [fontConfig, setFontConfig] = useState<AppFontConfig>(getSavedFontConfig());
  const [isFontExpanded, setIsFontExpanded] = useState(false);

  // Goal state
  const [goalMinutes, setGoalMinutesState] = useState<number>(getDailyGoalMinutes());
  const [customGoalInput, setCustomGoalInput] = useState<number>(goalMinutes);
  const [goalSavedNotification, setGoalSavedNotification] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem('libriaudio_profile_name');
    if (savedName) setName(savedName);

    const savedAutoFS = localStorage.getItem('libriaudio_auto_fullscreen');
    if (savedAutoFS !== null) {
      setAutoFullscreen(savedAutoFS === 'true');
    }

    const handleFSChange = () => {
      setIsFullscreen(isCurrentlyFullscreen());
    };

    document.addEventListener('fullscreenchange', handleFSChange);
    document.addEventListener('webkitfullscreenchange', handleFSChange);

    const handleThemeChange = () => {
      setCurrentTheme(getSavedTheme());
      setResolvedAdaptiveTheme(getSmartAdaptiveResolvedTheme());
    };
    window.addEventListener('libriaudio-theme-changed', handleThemeChange);

    const handleQualityChange = (e: any) => {
      const q = e?.detail?.quality || getSavedQualityPreference();
      setSelectedQuality(q);
    };
    window.addEventListener('libriaudio_quality_changed', handleQualityChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFSChange);
      document.removeEventListener('webkitfullscreenchange', handleFSChange);
      window.removeEventListener('libriaudio-theme-changed', handleThemeChange);
      window.removeEventListener('libriaudio_quality_changed', handleQualityChange);
    };
  }, []);

  const handleSelectQuality = (quality: AudioQualityPreference) => {
    setSelectedQuality(quality);
    saveQualityPreference(quality);
    setQualitySavedNotification(true);
    setTimeout(() => setQualitySavedNotification(false), 2000);
  };

  const handleSaveProfile = () => {
    localStorage.setItem('libriaudio_profile_name', name);
    localStorage.setItem('libriaudio_auto_fullscreen', String(autoFullscreen));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleToggleFullscreen = async () => {
    const nextState = await toggleFullscreenMode();
    setIsFullscreen(nextState);
  };

  const handleSelectTheme = (themeId: ThemeId) => {
    setCurrentTheme(themeId);
    saveThemePreference(themeId);
    setResolvedAdaptiveTheme(getSmartAdaptiveResolvedTheme());
  };

  const handleOpenCustomEditor = () => {
    setCustomColors(getSavedCustomTheme());
    setIsCustomEditorOpen(true);
    setCurrentTheme('custom');
    saveThemePreference('custom');
  };

  const handleUpdateCustomColor = (key: keyof CustomThemeInput, value: string) => {
    const next = { ...customColors, [key]: value };
    setCustomColors(next);
    // Live preview the change on the DOM (without persisting yet)
    previewCustomTheme(next);
  };

  const handleSaveCustomTheme = () => {
    saveCustomThemeColors(customColors);
    setCurrentTheme('custom');
    saveThemePreference('custom');
    setCustomSavedNote(true);
    setTimeout(() => setCustomSavedNote(false), 2000);
  };

  const handleUpdateFont = (partial: Partial<AppFontConfig>) => {
    const next = { ...fontConfig, ...partial };
    setFontConfig(next);
    saveFontConfig(next);
  };

  const handleUpdateGoal = (mins: number) => {
    const updated = setDailyGoalMinutes(mins);
    setGoalMinutesState(updated);
    setCustomGoalInput(updated);
    setGoalSavedNotification(true);
    setTimeout(() => setGoalSavedNotification(false), 2000);
  };

  const todayStats = getTodayGoalProgress();
  const themeList = Object.values(THEMES);
  const activeThemeMeta = THEMES[currentTheme] || THEMES['midnight-gold'];

  return (
    <div className="max-w-2xl mx-auto w-full p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-28">
      <div className="mb-8 text-center sm:text-left">
        <h2 className="text-3xl font-serif-display italic font-bold text-[var(--text-main)] tracking-wide">
          Profile & Preferences
        </h2>
        <p className="text-sm text-[var(--text-dim)] mt-2">
          Customize themes, listening targets, and on-device preferences.
        </p>
      </div>

      <div className="space-y-6">
        {/* Smart Theme Swapping Section (Collapsible - expands only when asked) */}
        <div
          id="settings-theme-card"
          className={`bg-[var(--surface)] border rounded-2xl transition-all duration-300 ${
            isThemeExpanded
              ? 'border-[var(--accent)] p-6 shadow-xl shadow-black/40'
              : 'border-[var(--border-subtle)] hover:border-[var(--border-subtle)] p-5'
          }`}
        >
          <div
            id="settings-theme-header"
            onClick={() => setIsThemeExpanded((prev) => !prev)}
            className="flex items-center justify-between cursor-pointer select-none group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)] group-hover:bg-[var(--accent-dim)] transition-colors shrink-0">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-semibold text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">
                    Theme & Appearance
                  </h3>
                  {!isThemeExpanded && (
                    <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-main)] font-serif-display italic">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: activeThemeMeta.previewColors[0] }}
                      />
                      {activeThemeMeta.name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-dim)]">
                  {isThemeExpanded
                    ? 'Select a theme below or enable Smart Ambient Mode for automatic day/night transitions.'
                    : 'Click to expand and customize color themes & adaptive modes.'}
                </p>
              </div>
            </div>

            <button
              id="btn-toggle-theme-accordion"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsThemeExpanded((prev) => !prev);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--accent-dim)] group-hover:bg-[var(--accent-dim)] border border-[var(--border-subtle)] hover:border-[var(--accent)] text-xs font-medium text-[var(--text-main)] hover:text-[var(--accent)] transition-all ml-2 shrink-0"
              aria-expanded={isThemeExpanded}
              aria-label={isThemeExpanded ? 'Collapse themes' : 'Expand themes'}
            >
              <span>{isThemeExpanded ? 'Collapse' : 'Customize'}</span>
              {isThemeExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-[var(--accent)]" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[var(--text-dim)] group-hover:text-[var(--accent)]" />
              )}
            </button>
          </div>

          {/* Expandable Theme Selection Grid */}
          {isThemeExpanded && (
            <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {themeList.map((theme) => {
                  const isSelected = currentTheme === theme.id;
                  const isAdaptive = theme.id === 'smart-adaptive';
                  const isCustom = theme.id === 'custom';
                  const swatches = isCustom
                    ? [customColors.bg, customColors.surface, customColors.accent]
                    : theme.previewColors;

                  return (
                    <button
                      key={theme.id}
                      id={`btn-theme-${theme.id}`}
                      onClick={() => (isCustom ? handleOpenCustomEditor() : handleSelectTheme(theme.id))}
                      className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                        isSelected
                          ? 'border-[var(--accent)] bg-[var(--surface-raised)] shadow-lg shadow-[rgba(var(--accent-rgb),0.3)]'
                          : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--border-subtle)] hover:bg-[var(--surface-raised)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2 w-full">
                        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-black/40 border border-[var(--border-subtle)]">
                          <div
                            className="w-3.5 h-3.5 rounded-full border border-[var(--border-subtle)]"
                            style={{ backgroundColor: swatches[0] }}
                          />
                          <div
                            className="w-3.5 h-3.5 rounded-full border border-[var(--border-subtle)]"
                            style={{ backgroundColor: swatches[1] }}
                          />
                          <div
                            className="w-3.5 h-3.5 rounded-full border border-[var(--border-subtle)]"
                            style={{ backgroundColor: swatches[2] }}
                          />
                        </div>
                        {isSelected && (
                          <span className="w-4 h-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] flex items-center justify-center text-[10px]">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[var(--text-main)] font-serif-display italic">
                            {theme.name}
                          </span>
                          {isAdaptive && (
                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]">
                              Auto
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--text-dim)] mt-0.5 leading-snug line-clamp-2">
                          {theme.subtitle}
                        </p>
                      </div>

                      {isAdaptive && isSelected && (
                        <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] text-[var(--accent)] font-mono w-full">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Active:
                          </span>
                          <span className="font-bold">
                            {THEMES[resolvedAdaptiveTheme]?.name || 'Adaptive'}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Custom Color Studio — appears when Custom theme is active */}
              {currentTheme === 'custom' && (
                <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                      Custom Color Studio
                    </h4>
                    {customSavedNote && (
                      <span className="text-[10px] font-semibold text-[var(--success)] flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[3]" /> Saved
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
                    Start from a curated palette or pick your own colors. Tap any swatch to open the full color editor.
                  </p>

                  {/* Palette Presets — scrollable row */}
                  <div>
                    <div className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider mb-2">
                      Quick Palettes
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
                      {PALETTE_PRESETS.map((p) => {
                        const isActive =
                          customColors.bg === p.bg &&
                          customColors.surface === p.surface &&
                          customColors.accent === p.accent &&
                          customColors.textMain === p.textMain;
                        return (
                          <button
                            key={p.id}
                            onClick={() => {
                              const next = { bg: p.bg, surface: p.surface, accent: p.accent, textMain: p.textMain };
                              setCustomColors(next);
                              previewCustomTheme(next);
                              setEditingColorField(null);
                            }}
                            className={`shrink-0 w-[72px] rounded-xl border transition-all duration-200 p-1.5 flex flex-col items-center gap-1 ${
                              isActive
                                ? 'border-[var(--accent)] bg-[var(--accent-dim)] shadow-md'
                                : 'border-[var(--border-subtle)] hover:border-[var(--accent)] bg-[var(--surface)]'
                            }`}
                          >
                            <div className="flex gap-0.5">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.bg }} />
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.surface }} />
                            </div>
                            <div className="flex gap-0.5">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.accent }} />
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.textMain }} />
                            </div>
                            <span className="text-[8px] text-[var(--text-dim)] leading-tight text-center truncate w-full">
                              {p.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Individual color fields with HSB picker */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider">
                      Fine-Tune Colors
                    </div>
                    {(
                      [
                        { key: 'bg', label: 'Background', hint: 'Base app & player backdrop' },
                        { key: 'surface', label: 'Panels', hint: 'Cards, menus & raised surfaces' },
                        { key: 'accent', label: 'Accent', hint: 'Buttons, highlights & icons' },
                        { key: 'textMain', label: 'Text', hint: 'Primary text color' },
                      ] as { key: keyof CustomThemeInput; label: string; hint: string }[]
                    ).map((f) => {
                      const isOpen = editingColorField === f.key;
                      return (
                        <div key={f.key}>
                          <button
                            onClick={() => {
                              setEditingColorField(isOpen ? null : f.key);
                            }}
                            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--surface-raised)] transition-colors text-left"
                          >
                            <div
                              className="w-10 h-10 rounded-xl border border-[var(--border-subtle)] shrink-0 shadow-inner"
                              style={{ backgroundColor: customColors[f.key] }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-[var(--text-main)]">{f.label}</div>
                              <div className="text-[10px] text-[var(--text-dim)] truncate">{f.hint}</div>
                            </div>
                            <span className="font-mono text-[10px] text-[var(--text-dim)] uppercase">
                              {customColors[f.key]}
                            </span>
                            <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-dim)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                          </button>
                          {isOpen && (
                            <div className="pl-2 pr-1 pb-2">
                              <ColorPickerPanel
                                color={customColors[f.key]}
                                onChange={(hex) => handleUpdateCustomColor(f.key, hex)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Live preview (uses applied CSS vars so it matches current preview) */}
                  <div
                    className="p-3 rounded-xl border border-[var(--border-subtle)] space-y-2"
                    style={{ backgroundColor: 'var(--surface)', color: 'var(--text-main)' }}
                  >
                    <div className="text-[11px] font-semibold">Live Preview</div>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shadow-md shrink-0"
                        style={{ backgroundColor: 'var(--accent)', color: 'var(--on-accent)' }}
                      >
                        Aa
                      </span>
                      <span className="text-[10px] opacity-70 leading-snug">
                        This is how the app will look with your palette, from menus to the player.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveCustomTheme}
                      className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-lg"
                      style={{ backgroundColor: 'var(--accent)', color: 'var(--on-accent)' }}
                    >
                      Apply & Save Custom Theme
                    </button>
                    <button
                      onClick={() => {
                        const fallback: ThemeId = getSavedTheme() !== 'custom' ? getSavedTheme() : 'midnight-gold';
                        handleSelectTheme(fallback);
                        setEditingColorField(null);
                      }}
                      className="px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text-main)] transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Typography & Fonts Customization Section */}
        <div
          id="settings-font-card"
          className={`bg-[var(--surface)] border rounded-2xl transition-all duration-300 ${
            isFontExpanded
              ? 'border-[var(--accent)] p-6 shadow-xl shadow-black/40'
              : 'border-[var(--border-subtle)] hover:border-[var(--border-subtle)] p-5'
          }`}
        >
          <div
            id="settings-font-header"
            onClick={() => setIsFontExpanded((prev) => !prev)}
            className="flex items-center justify-between cursor-pointer select-none group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)] group-hover:bg-[var(--accent-dim)] transition-colors shrink-0">
                <Type className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-semibold text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">
                    Typography & Fonts
                  </h3>
                  {!isFontExpanded && (
                    <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-main)] font-serif-display italic">
                      Header / Body Custom
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-dim)]">
                  {isFontExpanded
                    ? 'Customize header typography and body reading fonts.'
                    : 'Click to expand and customize application fonts.'}
                </p>
              </div>
            </div>

            <button
              id="btn-toggle-font-accordion"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsFontExpanded((prev) => !prev);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--accent-dim)] group-hover:bg-[var(--accent-dim)] border border-[var(--border-subtle)] hover:border-[var(--accent)] text-xs font-medium text-[var(--text-main)] hover:text-[var(--accent)] transition-all ml-2 shrink-0"
              aria-expanded={isFontExpanded}
            >
              <span>{isFontExpanded ? 'Collapse' : 'Customize'}</span>
              {isFontExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-[var(--accent)]" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[var(--text-dim)] group-hover:text-[var(--accent)]" />
              )}
            </button>
          </div>

          {isFontExpanded && (
            <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* Header Font Picker */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-main)] mb-2">
                  Header Font (Titles, Headings)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FONT_OPTIONS.header.map((font) => {
                    const isSelected = fontConfig.headerFont === font.value;
                    return (
                      <button
                        key={font.name}
                        onClick={() => handleUpdateFont({ headerFont: font.value })}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--text-main)] font-semibold'
                            : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-main)] hover:text-[var(--text-main)] hover:bg-[var(--surface-raised)]'
                        }`}
                        style={{ fontFamily: font.value }}
                      >
                        <span className="text-sm truncate">{font.name}</span>
                        {isSelected && <Check className="w-4 h-4 text-[var(--accent)] shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Body Font Picker */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-main)] mb-2">
                  Body Font (Reading, UI Text)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FONT_OPTIONS.body.map((font) => {
                    const isSelected = fontConfig.bodyFont === font.value;
                    return (
                      <button
                        key={font.name}
                        onClick={() => handleUpdateFont({ bodyFont: font.value })}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--text-main)] font-semibold'
                            : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-main)] hover:text-[var(--text-main)] hover:bg-[var(--surface-raised)]'
                        }`}
                        style={{ fontFamily: font.value }}
                      >
                        <span className="text-sm truncate">{font.name}</span>
                        {isSelected && <Check className="w-4 h-4 text-[var(--accent)] shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Streaming Audio Quality Section */}
        <div
          id="settings-audio-quality-card"
          className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-lg"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)]">
                <Headphones className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-main)] flex items-center gap-2">
                  Streaming Audio Quality
                  <span className="text-[10px] font-mono font-bold bg-[var(--accent-dim)] text-[var(--accent)] px-2 py-0.5 rounded-full border border-[var(--accent)] uppercase">
                    {QUALITY_CONFIGS.find((c) => c.id === selectedQuality)?.bitrateLabel || '128 kbps'}
                  </span>
                </h3>
                <p className="text-xs text-[var(--text-dim)]">
                  Select your streaming bitrate preference. Audiobooks with multiple quality versions are automatically segmented and deduplicated for continuous chapter listening.
                </p>
              </div>
            </div>
            {qualitySavedNotification && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 shrink-0">
                <Check className="w-3 h-3" /> Saved
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {QUALITY_CONFIGS.map((cfg) => {
              const isSelected = selectedQuality === cfg.id;
              return (
                <button
                  key={cfg.id}
                  id={`settings-quality-tier-${cfg.id}`}
                  onClick={() => handleSelectQuality(cfg.id)}
                  className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[var(--accent-dim)] border-[var(--accent)] shadow-md shadow-[rgba(var(--accent-rgb),0.3)] ring-1 ring-[var(--accent)]'
                      : 'bg-[var(--surface-raised)] border-[var(--border-subtle)] hover:border-[var(--border-subtle)] hover:bg-[var(--surface-raised)]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-bold uppercase tracking-wider font-mono ${
                        isSelected ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'
                      }`}>
                        {cfg.bitrateLabel}
                      </span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-[var(--accent)] shadow-[0_0_8px_#C5A059]" />
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-[var(--text-main)] mb-1">
                      {cfg.name}
                    </h4>
                    <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
                      {cfg.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] font-mono text-[var(--text-dim)]">
                    <span>{cfg.badge}</span>
                    <span className={isSelected ? 'text-[var(--accent)] font-bold' : ''}>
                      {isSelected ? 'Selected' : 'Select'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Daily Listening Goal Section */}
        <div id="settings-daily-goal-card" className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)]">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-main)]">Daily Listening Goal</h3>
                <p className="text-xs text-[var(--text-dim)]">
                  Set your daily target to cultivate a consistent reading and listening habit.
                </p>
              </div>
            </div>
            {goalSavedNotification && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <Check className="w-3 h-3" /> Updated
              </span>
            )}
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-[var(--text-dim)] mb-2 uppercase tracking-wider">
                Select Daily Target
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {GOAL_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    id={`settings-goal-preset-${preset}`}
                    onClick={() => handleUpdateGoal(preset)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                      goalMinutes === preset
                        ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)] shadow-md shadow-[rgba(var(--accent-rgb),0.3)]'
                        : 'bg-[var(--surface-raised)] text-[var(--text-main)] hover:text-[var(--text-main)] border-[var(--border-subtle)] hover:border-[var(--border-subtle)]'
                    }`}
                  >
                    {preset} mins
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            <div className="flex items-center gap-3 pt-1">
              <div className="flex-1 flex items-center bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5">
                <span className="text-xs text-[var(--text-dim)] mr-2">Custom Target:</span>
                <input
                  type="number"
                  min="5"
                  max="720"
                  value={customGoalInput}
                  onChange={(e) => setCustomGoalInput(parseInt(e.target.value, 10) || 5)}
                  className="w-20 bg-transparent text-sm font-mono text-[var(--text-main)] focus:outline-none"
                />
                <span className="text-xs text-[var(--text-dim)]">minutes per day</span>
              </div>
              <button
                onClick={() => handleUpdateGoal(customGoalInput)}
                className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-xs hover:bg-[var(--accent-hover)] transition-colors"
              >
                Set Custom
              </button>
            </div>

            {/* Goal Today Overview */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[var(--text-main)]">
                <Flame className="w-4 h-4 text-amber-400 fill-current" />
                <span>
                  Today: <strong className="text-[var(--text-main)]">{todayStats.listenedMinutes}m</strong> logged ({todayStats.percentage}% of {goalMinutes}m target)
                </span>
              </div>
              <span className="font-mono text-[11px] text-[var(--accent)]">
                {todayStats.dailyStreak} Day Streak
              </span>
            </div>
          </div>
        </div>

        {/* On-Device Profile */}
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)]">
              <User className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-main)]">On-Device Profile</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-dim)] mb-2 uppercase tracking-wider">
                Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-[var(--text-main)] placeholder-white/30 focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
            
            <button
              onClick={handleSaveProfile}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] font-semibold hover:bg-[var(--accent-hover)] transition-colors flex items-center justify-center gap-2 text-sm"
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Preferences
                </>
              )}
            </button>
          </div>
        </div>

        {/* Application Cache */}
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)]">
              <Settings className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-main)]">Application Data</h3>
          </div>
          <p className="text-sm text-[var(--text-dim)] leading-relaxed mb-4">
            Your reading history, bookmarks, offline audiobooks, and daily goals are stored locally on this device.
          </p>
          <button 
            onClick={() => {
              if (window.confirm("Are you sure you want to clear all local data? This cannot be undone.")) {
                localStorage.removeItem('libriaudio_state');
                localStorage.removeItem('libriaudio_profile_name');
                localStorage.removeItem('libriaudio_auto_fullscreen');
                localStorage.removeItem('libriaudio_true_activity_v1');
                localStorage.removeItem('libriaudio_reading_sessions_v1');
                localStorage.removeItem('libriaudio_daily_listening_goal_mins');
                localStorage.removeItem('libriaudio_theme_preference');
                localStorage.removeItem('libriaudio_font_config');
                localStorage.removeItem('libriaudio_streaming_quality');
                window.location.reload();
              }
            }}
            className="px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-medium transition-colors"
          >
            Clear Local Data Cache
          </button>
        </div>
      </div>
    </div>
  );
};
