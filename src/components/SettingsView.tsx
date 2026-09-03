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
  Download,
  Upload,
  HardDrive,
  Shield,
  SlidersHorizontal,
  Image,
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
import { useMiniLighting, saveMiniLighting } from '../utils/miniPlayerLighting';
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
import {
  CoverAspect,
  getSavedCoverAspect,
  saveCoverAspect,
} from '../utils/coverAspect';

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

  // Book cover aspect ratio
  const [coverAspect, setCoverAspectState] = useState<CoverAspect>(getSavedCoverAspect());
  const miniLighting = useMiniLighting();

  // Goal state
  const [goalMinutes, setGoalMinutesState] = useState<number>(getDailyGoalMinutes());
  const [customGoalInput, setCustomGoalInput] = useState<number>(goalMinutes);
  const [goalSavedNotification, setGoalSavedNotification] = useState(false);

  // Export/Import state
  const [exportNotification, setExportNotification] = useState(false);
  const [importNotification, setImportNotification] = useState(false);

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

  const handleExportData = async () => {
    try {
      const data: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('libriaudio_') || key.startsWith('libreaudio_'))) {
          const val = localStorage.getItem(key);
          if (val !== null) data[key] = val;
        }
      }

      const exportData = {
        version: 2,
        exportedAt: new Date().toISOString(),
        app: 'LibreAudio',
        data,
      };

      const jsonStr = JSON.stringify(exportData, null, 2);
      const filename = `libreaudio-backup-${new Date().toISOString().slice(0, 10)}.json`;

      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const FileBackup = (await import('../utils/fileBackupNative')).default;
        const result = await FileBackup.saveToDownloads({
          filename,
          content: jsonStr,
          mimeType: 'application/json',
        });
        if (!result.success) {
          alert('Failed to save backup file.');
          return;
        }
      } else {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setExportNotification(true);
      setTimeout(() => setExportNotification(false), 2000);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importData = JSON.parse(text);

        if (importData.app !== 'LibreAudio') {
          alert('This does not appear to be a LibreAudio backup file.');
          return;
        }

        if (!window.confirm('Importing will replace your current data. This cannot be undone. Continue?')) {
          return;
        }

        // v2: flat key-value map. v1: legacy structured format.
        if (importData.version === 2 && importData.data && typeof importData.data === 'object') {
          const d = importData.data as Record<string, string>;
          for (const [key, val] of Object.entries(d)) {
            if (typeof val === 'string') localStorage.setItem(key, val);
          }
        } else {
          // v1 fallback — map structured fields back to localStorage keys.
          const d = importData.data;
          if (d.state) localStorage.setItem('libriaudio_state', JSON.stringify(d.state));
          if (d.profileName) localStorage.setItem('libriaudio_profile_name', d.profileName);
          if (d.theme) localStorage.setItem('libriaudio_theme_preference', d.theme);
          if (d.streamingQuality) localStorage.setItem('libriaudio_streaming_quality', d.streamingQuality);
          if (d.fontConfig) localStorage.setItem('libriaudio_font_config', JSON.stringify(d.fontConfig));
          if (d.dailyGoalMinutes) localStorage.setItem('libriaudio_daily_listening_goal_mins', String(d.dailyGoalMinutes));
          if (d.activityData) localStorage.setItem('libriaudio_true_activity_v1', JSON.stringify(d.activityData));
          if (d.readingSessions) localStorage.setItem('libriaudio_reading_sessions_v1', JSON.stringify(d.readingSessions));
        }

        setImportNotification(true);
        setTimeout(() => {
          setImportNotification(false);
          window.location.reload();
        }, 1500);
      } catch (err) {
        alert('Failed to import: The file may be corrupted or invalid.');
      }
    };
    input.click();
  };

  const handleClearData = () => {
    if (window.confirm('Are you sure you want to clear all local data? This cannot be undone.')) {
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
  };

  const todayStats = getTodayGoalProgress();
  const themeList = Object.values(THEMES);
  const activeThemeMeta = THEMES[currentTheme] || THEMES['slate-mono'];

  return (
    <div className="max-w-2xl mx-auto w-full p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-28">
      <div className="mb-8 text-center sm:text-left">
        <h2 className="text-3xl font-serif-display italic font-bold text-[var(--text-main)] tracking-wide">
          Settings
        </h2>
        <p className="text-sm text-[var(--text-dim)] mt-2">
          Manage your profile, data, and audio preferences.
        </p>
      </div>

      <div className="space-y-5">

        {/* ═══════════════════════════════════════════════════ */}
        {/* USER PROFILE SECTION                                */}
        {/* ═══════════════════════════════════════════════════ */}
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)]">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-main)]">User Profile</h3>
              <p className="text-[11px] text-[var(--text-dim)]">Your display name and avatar</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Display Name */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)] mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-[var(--bg)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-sm text-[var(--text-main)] placeholder-white/30 focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>

            <button
              onClick={handleSaveProfile}
              className="w-full px-4 py-3 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-sm hover:bg-[var(--accent-hover)] transition-colors flex items-center justify-center gap-2"
            >
              {isSaved ? (
                <><Check className="w-4 h-4" /> Saved</>
              ) : (
                <><Save className="w-4 h-4" /> Save Profile</>
              )}
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════ */}
        {/* DATA MANAGEMENT SECTION                              */}
        {/* ═══════════════════════════════════════════════════ */}
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)]">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-main)]">Data Management</h3>
              <p className="text-[11px] text-[var(--text-dim)]">Export, import, or clear your app data</p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleExportData}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-[var(--bg)] hover:bg-[var(--surface-raised)] border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-all group text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)] shrink-0">
                <Download className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">
                  Export Data
                </p>
                <p className="text-[10px] text-[var(--text-dim)]">
                  Save listening progress, bookmarks & settings as .json
                </p>
              </div>
              {exportNotification && (
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
                  <Check className="w-3 h-3" /> Exported
                </span>
              )}
            </button>

            <button
              onClick={handleImportData}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-[var(--bg)] hover:bg-[var(--surface-raised)] border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-all group text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)] shrink-0">
                <Upload className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">
                  Import Data
                </p>
                <p className="text-[10px] text-[var(--text-dim)]">
                  Restore from a previously exported backup file
                </p>
              </div>
              {importNotification && (
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
                  <Check className="w-3 h-3" /> Imported
                </span>
              )}
            </button>

            <div className="border-t border-[var(--border-subtle)] pt-3 mt-3">
              <button
                onClick={handleClearData}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-all group text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-400 group-hover:text-red-300 transition-colors">
                    Clear All Data
                  </p>
                  <p className="text-[10px] text-red-400/60">
                    Permanently remove all local app data
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════ */}
        {/* AUDIO & HARDWARE SECTION                             */}
        {/* ═══════════════════════════════════════════════════ */}
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)]">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-main)]">Audio & Hardware</h3>
              <p className="text-[11px] text-[var(--text-dim)]">Equalizer, streaming quality & playback</p>
            </div>
          </div>

          <div className="space-y-3">
            {/* EQ Toggle */}
            <button
              onClick={() => {
                const preset = (localStorage.getItem('libriaudio_eq_preset') as any) || 'off';
                const next = preset === 'off' ? 'voice-clarity' : 'off';
                localStorage.setItem('libriaudio_eq_preset', next);
                window.dispatchEvent(new CustomEvent('libriaudio_eq_changed', { detail: { preset: next } }));
              }}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-[var(--bg)] hover:bg-[var(--surface-raised)] border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-all group text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)] shrink-0">
                <Sliders className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">
                  Equalizer
                </p>
                <p className="text-[10px] text-[var(--text-dim)]">
                  Voice Clarity EQ for clearer narration
                </p>
              </div>
              <div className={`w-10 h-5 rounded-full transition-colors relative ${
                (localStorage.getItem('libriaudio_eq_preset') || 'off') !== 'off'
                  ? 'bg-[var(--accent)]'
                  : 'bg-[var(--surface-raised)] border border-[var(--border-subtle)]'
              }`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  (localStorage.getItem('libriaudio_eq_preset') || 'off') !== 'off'
                    ? 'translate-x-5'
                    : 'translate-x-0.5'
                }`} />
              </div>
            </button>

            {/* Dynamic Lighting Toggle */}
            <button
              id="settings-mini-lighting"
              onClick={() => {
                saveMiniLighting(!miniLighting);
              }}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-[var(--bg)] hover:bg-[var(--surface-raised)] border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-all group text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)] shrink-0">
                <Sun className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">
                  Dynamic Lighting
                </p>
                <p className="text-[10px] text-[var(--text-dim)]">
                  Animated ambient glow on the mini player
                </p>
              </div>
              <div className={`w-10 h-5 rounded-full transition-colors relative ${
                miniLighting
                  ? 'bg-[var(--accent)]'
                  : 'bg-[var(--surface-raised)] border border-[var(--border-subtle)]'
              }`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  miniLighting
                    ? 'translate-x-5'
                    : 'translate-x-0.5'
                }`} />
              </div>
            </button>

            <div className="rounded-xl bg-[var(--bg)] border border-[var(--border-subtle)] p-3.5">              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)] shrink-0">
                  <Headphones className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-main)]">Streaming Quality</p>
                  <p className="text-[10px] text-[var(--text-dim)]">
                    {QUALITY_CONFIGS.find((c) => c.id === selectedQuality)?.bitrateLabel || 'Standard'} selected
                  </p>
                </div>
                {qualitySavedNotification && (
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
                    <Check className="w-3 h-3" /> Saved
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {QUALITY_CONFIGS.map((cfg) => {
                  const isSelected = selectedQuality === cfg.id;
                  return (
                    <button
                      key={cfg.id}
                      onClick={() => handleSelectQuality(cfg.id)}
                      className={`py-2 px-2 rounded-lg text-[11px] font-semibold transition-all border ${
                        isSelected
                          ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)]'
                          : 'bg-[var(--surface-raised)] text-[var(--text-main)] border-[var(--border-subtle)] hover:border-[var(--accent)]'
                      }`}
                    >
                      {cfg.bitrateLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════ */}
        {/* THEME & APPEARANCE (Collapsible)                     */}
        {/* ═══════════════════════════════════════════════════ */}
        <div
          id="settings-theme-card"
          className={`bg-[var(--surface)] border rounded-2xl transition-all duration-300 ${
            isThemeExpanded
              ? 'border-[var(--accent)] p-6 shadow-xl shadow-black/40'
              : 'border-[var(--border-subtle)] p-5'
          }`}
        >
          <div
            id="settings-theme-header"
            onClick={() => setIsThemeExpanded((prev) => !prev)}
            className="flex items-center justify-between cursor-pointer select-none group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)] shrink-0">
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
                    ? 'Select a theme below or enable Smart Ambient Mode.'
                    : 'Click to customize color themes & adaptive modes.'}
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--accent-dim)] border border-[var(--border-subtle)] hover:border-[var(--accent)] text-xs font-medium text-[var(--text-main)] hover:text-[var(--accent)] transition-all ml-2 shrink-0"
            >
              <span>{isThemeExpanded ? 'Collapse' : 'Customize'}</span>
              {isThemeExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-[var(--accent)]" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[var(--text-dim)]" />
              )}
            </button>
          </div>

          {isThemeExpanded && (
            <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] animate-in fade-in slide-in-from-top-2 duration-300 space-y-5">
              {/* Horizontal scrollable theme list */}
              <div>
                <div className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider mb-2">Choose a Theme</div>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
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
                        className={`shrink-0 w-[100px] p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col items-center gap-2 ${
                          isSelected
                            ? 'border-[var(--accent)] bg-[var(--surface-raised)] shadow-lg shadow-[rgba(var(--accent-rgb),0.3)]'
                            : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--accent)]'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          {swatches.map((c, i) => (
                            <div key={i} className="w-4 h-4 rounded-full border border-[var(--border-subtle)]" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                        <div className="text-center w-full">
                          <div className="text-[11px] font-bold text-[var(--text-main)] font-serif-display italic leading-tight truncate">{theme.name}</div>
                          {isAdaptive && (
                            <span className="text-[8px] uppercase font-bold px-1 py-0.5 rounded bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)] mt-0.5 inline-block">Auto</span>
                          )}
                        </div>
                        {isSelected && (
                          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] flex items-center justify-center text-[10px]">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                        {isAdaptive && isSelected && (
                          <div className="text-[8px] text-[var(--accent)] font-mono text-center leading-tight">
                            {THEMES[resolvedAdaptiveTheme]?.name || 'Adaptive'}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Theme & Color Studio */}
              <div className="pt-4 border-t border-[var(--border-subtle)] space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">Custom Theme</h4>
                  {customSavedNote && (
                    <span className="text-[10px] font-semibold text-[var(--success)] flex items-center gap-1">
                      <Check className="w-3 h-3 stroke-[3]" /> Saved
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider">Fine-Tune Colors</div>
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
                          onClick={() => setEditingColorField(isOpen ? null : f.key)}
                          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--surface-raised)] transition-colors text-left"
                        >
                          <div className="w-10 h-10 rounded-xl border border-[var(--border-subtle)] shrink-0 shadow-inner" style={{ backgroundColor: customColors[f.key] }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-[var(--text-main)]">{f.label}</div>
                            <div className="text-[10px] text-[var(--text-dim)] truncate">{f.hint}</div>
                          </div>
                          <span className="font-mono text-[10px] text-[var(--text-dim)] uppercase">{customColors[f.key]}</span>
                          <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-dim)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isOpen && (
                          <div className="pl-2 pr-1 pb-2">
                            <ColorPickerPanel color={customColors[f.key]} onChange={(hex) => handleUpdateCustomColor(f.key, hex)} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={handleSaveCustomTheme} className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-lg" style={{ backgroundColor: 'var(--accent)', color: 'var(--on-accent)' }}>
                    Apply & Save Custom Theme
                  </button>
                  <button
                    onClick={() => {
                      const fallback: ThemeId = getSavedTheme() !== 'custom' ? getSavedTheme() : 'slate-mono';
                      handleSelectTheme(fallback);
                      setEditingColorField(null);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text-main)] transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════ */}
        {/* TYPOGRAPHY (Collapsible)                              */}
        {/* ═══════════════════════════════════════════════════ */}
        <div
          id="settings-font-card"
          className={`bg-[var(--surface)] border rounded-2xl transition-all duration-300 ${
            isFontExpanded ? 'border-[var(--accent)] p-6 shadow-xl shadow-black/40' : 'border-[var(--border-subtle)] p-5'
          }`}
        >
          <div
            id="settings-font-header"
            onClick={() => setIsFontExpanded((prev) => !prev)}
            className="flex items-center justify-between cursor-pointer select-none group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)] shrink-0">
                <Type className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">
                  Typography & Fonts
                </h3>
                <p className="text-xs text-[var(--text-dim)]">
                  {isFontExpanded ? 'Customize header and body fonts.' : 'Click to customize fonts.'}
                </p>
              </div>
            </div>
            <button
              id="btn-toggle-font-accordion"
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsFontExpanded((prev) => !prev); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--accent-dim)] border border-[var(--border-subtle)] hover:border-[var(--accent)] text-xs font-medium text-[var(--text-main)] hover:text-[var(--accent)] transition-all ml-2 shrink-0"
            >
              <span>{isFontExpanded ? 'Collapse' : 'Customize'}</span>
              {isFontExpanded ? <ChevronUp className="w-3.5 h-3.5 text-[var(--accent)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--text-dim)]" />}
            </button>
          </div>

          {isFontExpanded && (
            <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-main)] mb-2">Header Font</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FONT_OPTIONS.header.map((font) => {
                    const isSelected = fontConfig.headerFont === font.value;
                    return (
                      <button
                        key={font.name}
                        onClick={() => handleUpdateFont({ headerFont: font.value })}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${isSelected ? 'border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--text-main)] font-semibold' : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-main)] hover:bg-[var(--surface-raised)]'}`}
                        style={{ fontFamily: font.value }}
                      >
                        <span className="text-sm truncate">{font.name}</span>
                        {isSelected && <Check className="w-4 h-4 text-[var(--accent)] shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-main)] mb-2">Body Font</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FONT_OPTIONS.body.map((font) => {
                    const isSelected = fontConfig.bodyFont === font.value;
                    return (
                      <button
                        key={font.name}
                        onClick={() => handleUpdateFont({ bodyFont: font.value })}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${isSelected ? 'border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--text-main)] font-semibold' : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-main)] hover:bg-[var(--surface-raised)]'}`}
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

        {/* ═══════════════════════════════════════════════════ */}
        {/* BOOK COVER DISPLAY                                   */}
        {/* ═══════════════════════════════════════════════════ */}
        <div id="settings-cover-card" className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)] shrink-0">
                <Image className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-[var(--text-main)]">Book Cover Display</h3>
                <p className="text-xs text-[var(--text-dim)]">Choose how covers appear in browse views. The player always shows square covers.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {(
              [
                { id: '1:1', label: 'Square 1:1', desc: 'Balanced tiles' },
                { id: '3:4', label: 'Vertical 3:4', desc: 'Classic book shape' },
              ] as { id: CoverAspect; label: string; desc: string }[]
            ).map((opt) => {
              const isSelected = coverAspect === opt.id;
              return (
                <button
                  key={opt.id}
                  id={`settings-cover-${opt.id === '1:1' ? 'square' : 'vertical'}`}
                  onClick={() => {
                    setCoverAspectState(opt.id);
                    saveCoverAspect(opt.id);
                  }}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    isSelected
                      ? 'bg-[var(--surface-raised)] border-[var(--accent)] shadow-md'
                      : 'bg-[var(--surface-raised)] border-[var(--border-subtle)] hover:border-[var(--accent)]'
                  }`}
                >
                  <div
                    className={`shrink-0 rounded-md bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center ${
                      opt.id === '1:1' ? 'w-8 h-8' : 'w-8 h-10'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className={`text-sm font-semibold ${isSelected ? 'text-[var(--accent)]' : 'text-[var(--text-main)]'}`}>
                      {opt.label}
                    </div>
                    <div className="text-[11px] text-[var(--text-dim)] truncate">{opt.desc}</div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[var(--accent)] shrink-0 ml-auto" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════ */}
        {/* DAILY LISTENING GOAL                                 */}
        {/* ═══════════════════════════════════════════════════ */}
        <div id="settings-daily-goal-card" className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)]">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-main)]">Daily Listening Goal</h3>
                <p className="text-xs text-[var(--text-dim)]">Set your daily target.</p>
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
              <label className="block text-xs font-medium text-[var(--text-dim)] mb-2 uppercase tracking-wider">Select Daily Target</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {GOAL_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    id={`settings-goal-preset-${preset}`}
                    onClick={() => handleUpdateGoal(preset)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                      goalMinutes === preset
                        ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)] shadow-md shadow-[rgba(var(--accent-rgb),0.3)]'
                        : 'bg-[var(--surface-raised)] text-[var(--text-main)] border-[var(--border-subtle)] hover:border-[var(--border-subtle)]'
                    }`}
                  >
                    {preset} mins
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <div className="flex-1 flex items-center bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5">
                <span className="text-xs text-[var(--text-dim)] mr-2">Custom:</span>
                <input
                  type="number"
                  min="5"
                  max="720"
                  value={customGoalInput}
                  onChange={(e) => setCustomGoalInput(parseInt(e.target.value, 10) || 5)}
                  className="w-20 bg-transparent text-sm font-mono text-[var(--text-main)] focus:outline-none"
                />
                <span className="text-xs text-[var(--text-dim)]">min/day</span>
              </div>
              <button
                onClick={() => handleUpdateGoal(customGoalInput)}
                className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-xs hover:bg-[var(--accent-hover)] transition-colors"
              >
                Set
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[var(--text-main)]">
                <Flame className="w-4 h-4 text-amber-400 fill-current" />
                <span>
                  Today: <strong className="text-[var(--text-main)]">{todayStats.listenedMinutes}m</strong> ({todayStats.percentage}% of {goalMinutes}m)
                </span>
              </div>
              <span className="font-mono text-[11px] text-[var(--accent)]">
                {todayStats.dailyStreak} Day Streak
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
