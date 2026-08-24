import React, { useState, useEffect } from 'react';
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
        <h2 className="text-3xl font-serif-display italic font-bold text-white tracking-wide">
          Profile & Preferences
        </h2>
        <p className="text-sm text-white/50 mt-2">
          Customize themes, listening targets, and on-device preferences.
        </p>
      </div>

      <div className="space-y-6">
        {/* Smart Theme Swapping Section (Collapsible - expands only when asked) */}
        <div
          id="settings-theme-card"
          className={`bg-[#111111] border rounded-2xl transition-all duration-300 ${
            isThemeExpanded
              ? 'border-[#C5A059]/40 p-6 shadow-xl shadow-black/40'
              : 'border-white/[0.05] hover:border-white/20 p-5'
          }`}
        >
          <div
            id="settings-theme-header"
            onClick={() => setIsThemeExpanded((prev) => !prev)}
            className="flex items-center justify-between cursor-pointer select-none group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#C5A059]/15 border border-[#C5A059]/30 flex items-center justify-center text-[#C5A059] group-hover:bg-[#C5A059]/25 transition-colors shrink-0">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-semibold text-white group-hover:text-[#C5A059] transition-colors">
                    Theme & Appearance
                  </h3>
                  {!isThemeExpanded && (
                    <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-[11px] text-white/70 font-serif-display italic">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: activeThemeMeta.previewColors[0] }}
                      />
                      {activeThemeMeta.name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/50">
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-[#C5A059]/20 group-hover:bg-[#C5A059]/15 border border-white/10 hover:border-[#C5A059]/40 text-xs font-medium text-white/80 hover:text-[#C5A059] transition-all ml-2 shrink-0"
              aria-expanded={isThemeExpanded}
              aria-label={isThemeExpanded ? 'Collapse themes' : 'Expand themes'}
            >
              <span>{isThemeExpanded ? 'Collapse' : 'Customize'}</span>
              {isThemeExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-[#C5A059]" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-white/50 group-hover:text-[#C5A059]" />
              )}
            </button>
          </div>

          {/* Expandable Theme Selection Grid */}
          {isThemeExpanded && (
            <div className="mt-5 pt-4 border-t border-white/[0.08] animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {themeList.map((theme) => {
                  const isSelected = currentTheme === theme.id;
                  const isAdaptive = theme.id === 'smart-adaptive';

                  return (
                    <button
                      key={theme.id}
                      id={`btn-theme-${theme.id}`}
                      onClick={() => handleSelectTheme(theme.id)}
                      className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#C5A059] bg-white/[0.06] shadow-lg shadow-[#C5A059]/10'
                          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2 w-full">
                        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-black/40 border border-white/10">
                          <div
                            className="w-3.5 h-3.5 rounded-full border border-white/20"
                            style={{ backgroundColor: theme.previewColors[0] }}
                          />
                          <div
                            className="w-3.5 h-3.5 rounded-full border border-white/20"
                            style={{ backgroundColor: theme.previewColors[1] }}
                          />
                          <div
                            className="w-3.5 h-3.5 rounded-full border border-white/20"
                            style={{ backgroundColor: theme.previewColors[2] }}
                          />
                        </div>
                        {isSelected && (
                          <span className="w-4 h-4 rounded-full bg-[#C5A059] text-black flex items-center justify-center text-[10px]">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white font-serif-display italic">
                            {theme.name}
                          </span>
                          {isAdaptive && (
                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/30">
                              Auto
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/50 mt-0.5 leading-snug line-clamp-2">
                          {theme.subtitle}
                        </p>
                      </div>

                      {isAdaptive && isSelected && (
                        <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-[#C5A059] font-mono w-full">
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
            </div>
          )}
        </div>

        {/* Typography & Fonts Customization Section */}
        <div
          id="settings-font-card"
          className={`bg-[#111111] border rounded-2xl transition-all duration-300 ${
            isFontExpanded
              ? 'border-[#C5A059]/40 p-6 shadow-xl shadow-black/40'
              : 'border-white/[0.05] hover:border-white/20 p-5'
          }`}
        >
          <div
            id="settings-font-header"
            onClick={() => setIsFontExpanded((prev) => !prev)}
            className="flex items-center justify-between cursor-pointer select-none group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#C5A059]/15 border border-[#C5A059]/30 flex items-center justify-center text-[#C5A059] group-hover:bg-[#C5A059]/25 transition-colors shrink-0">
                <Type className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-semibold text-white group-hover:text-[#C5A059] transition-colors">
                    Typography & Fonts
                  </h3>
                  {!isFontExpanded && (
                    <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-[11px] text-white/70 font-serif-display italic">
                      Header / Body Custom
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/50">
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-[#C5A059]/20 group-hover:bg-[#C5A059]/15 border border-white/10 hover:border-[#C5A059]/40 text-xs font-medium text-white/80 hover:text-[#C5A059] transition-all ml-2 shrink-0"
              aria-expanded={isFontExpanded}
            >
              <span>{isFontExpanded ? 'Collapse' : 'Customize'}</span>
              {isFontExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-[#C5A059]" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-white/50 group-hover:text-[#C5A059]" />
              )}
            </button>
          </div>

          {isFontExpanded && (
            <div className="mt-5 pt-4 border-t border-white/[0.08] space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* Header Font Picker */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">
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
                            ? 'border-[#C5A059] bg-white/[0.06] text-white font-semibold'
                            : 'border-white/[0.06] bg-white/[0.02] text-white/70 hover:text-white hover:bg-white/[0.04]'
                        }`}
                        style={{ fontFamily: font.value }}
                      >
                        <span className="text-sm truncate">{font.name}</span>
                        {isSelected && <Check className="w-4 h-4 text-[#C5A059] shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Body Font Picker */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">
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
                            ? 'border-[#C5A059] bg-white/[0.06] text-white font-semibold'
                            : 'border-white/[0.06] bg-white/[0.02] text-white/70 hover:text-white hover:bg-white/[0.04]'
                        }`}
                        style={{ fontFamily: font.value }}
                      >
                        <span className="text-sm truncate">{font.name}</span>
                        {isSelected && <Check className="w-4 h-4 text-[#C5A059] shrink-0 ml-2" />}
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
          className="bg-[#111111] border border-white/[0.05] rounded-2xl p-6 shadow-lg"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#C5A059]/15 border border-[#C5A059]/30 flex items-center justify-center text-[#C5A059]">
                <Headphones className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  Streaming Audio Quality
                  <span className="text-[10px] font-mono font-bold bg-[#C5A059]/15 text-[#C5A059] px-2 py-0.5 rounded-full border border-[#C5A059]/30 uppercase">
                    {QUALITY_CONFIGS.find((c) => c.id === selectedQuality)?.bitrateLabel || '128 kbps'}
                  </span>
                </h3>
                <p className="text-xs text-white/50">
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
                      ? 'bg-[#C5A059]/15 border-[#C5A059] shadow-md shadow-[#C5A059]/10 ring-1 ring-[#C5A059]/40'
                      : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-bold uppercase tracking-wider font-mono ${
                        isSelected ? 'text-[#C5A059]' : 'text-white/60'
                      }`}>
                        {cfg.bitrateLabel}
                      </span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-[#C5A059] shadow-[0_0_8px_#C5A059]" />
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-white mb-1">
                      {cfg.name}
                    </h4>
                    <p className="text-[11px] text-white/50 leading-relaxed">
                      {cfg.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-white/40">
                    <span>{cfg.badge}</span>
                    <span className={isSelected ? 'text-[#C5A059] font-bold' : ''}>
                      {isSelected ? 'Selected' : 'Select'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Daily Listening Goal Section */}
        <div id="settings-daily-goal-card" className="bg-[#111111] border border-white/[0.05] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#C5A059]/15 border border-[#C5A059]/30 flex items-center justify-center text-[#C5A059]">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Daily Listening Goal</h3>
                <p className="text-xs text-white/50">
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
              <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">
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
                        ? 'bg-[#C5A059] text-black border-[#C5A059] shadow-md shadow-[#C5A059]/20'
                        : 'bg-white/[0.03] text-white/70 hover:text-white border-white/10 hover:border-white/20'
                    }`}
                  >
                    {preset} mins
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            <div className="flex items-center gap-3 pt-1">
              <div className="flex-1 flex items-center bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5">
                <span className="text-xs text-white/40 mr-2">Custom Target:</span>
                <input
                  type="number"
                  min="5"
                  max="720"
                  value={customGoalInput}
                  onChange={(e) => setCustomGoalInput(parseInt(e.target.value, 10) || 5)}
                  className="w-20 bg-transparent text-sm font-mono text-white focus:outline-none"
                />
                <span className="text-xs text-white/40">minutes per day</span>
              </div>
              <button
                onClick={() => handleUpdateGoal(customGoalInput)}
                className="px-5 py-2.5 rounded-xl bg-[#C5A059] text-black font-semibold text-xs hover:bg-[#d4af65] transition-colors"
              >
                Set Custom
              </button>
            </div>

            {/* Goal Today Overview */}
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-white/70">
                <Flame className="w-4 h-4 text-amber-400 fill-current" />
                <span>
                  Today: <strong className="text-white">{todayStats.listenedMinutes}m</strong> logged ({todayStats.percentage}% of {goalMinutes}m target)
                </span>
              </div>
              <span className="font-mono text-[11px] text-[#C5A059]">
                {todayStats.dailyStreak} Day Streak
              </span>
            </div>
          </div>
        </div>

        {/* On-Device Profile */}
        <div className="bg-[#111111] border border-white/[0.05] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-xl bg-[#C5A059]/15 border border-[#C5A059]/30 flex items-center justify-center text-[#C5A059]">
              <User className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-semibold text-white">On-Device Profile</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">
                Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#C5A059] transition-colors"
              />
            </div>
            
            <button
              onClick={handleSaveProfile}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#C5A059] text-black font-semibold hover:bg-[#d4af65] transition-colors flex items-center justify-center gap-2 text-sm"
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
        <div className="bg-[#111111] border border-white/[0.05] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl bg-[#C5A059]/15 border border-[#C5A059]/30 flex items-center justify-center text-[#C5A059]">
              <Settings className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-semibold text-white">Application Data</h3>
          </div>
          <p className="text-sm text-white/60 leading-relaxed mb-4">
            Your reading history, bookmarks, offline audiobooks, and daily goals are stored locally on this device.
          </p>
          <button 
            onClick={() => {
              if (window.confirm("Are you sure you want to clear all local data? This cannot be undone.")) {
                localStorage.removeItem('libriaudio_state');
                localStorage.removeItem('libriaudio_profile_name');
                localStorage.removeItem('libriaudio_auto_fullscreen');
                localStorage.removeItem('libriaudio_true_activity_v1');
                localStorage.removeItem('libriaudio_daily_listening_goal_mins');
                localStorage.removeItem('libriaudio_theme_preference');
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
