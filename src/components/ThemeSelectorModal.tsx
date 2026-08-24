import React, { useState, useEffect } from 'react';
import {
  Palette,
  Check,
  X,
  Sun,
  Moon,
  Clock,
  Sparkles,
  Laptop,
} from 'lucide-react';
import {
  THEMES,
  ThemeId,
  getSavedTheme,
  saveThemePreference,
  getSmartAdaptiveResolvedTheme,
} from '../utils/themeManager';

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTheme, setActiveTheme] = useState<ThemeId>(getSavedTheme());
  const [resolvedAdaptive, setResolvedAdaptive] = useState<ThemeId>(
    getSmartAdaptiveResolvedTheme()
  );

  useEffect(() => {
    if (isOpen) {
      setActiveTheme(getSavedTheme());
      setResolvedAdaptive(getSmartAdaptiveResolvedTheme());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectTheme = (themeId: ThemeId) => {
    setActiveTheme(themeId);
    saveThemePreference(themeId);
    setResolvedAdaptive(getSmartAdaptiveResolvedTheme());
  };

  const themeList = Object.values(THEMES);

  return (
    <div
      id="theme-selector-modal-overlay"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="theme-selector-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[#0E0E0E] rounded-t-3xl sm:rounded-3xl border border-white/[0.12] shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] bg-[#141414]/90 shrink-0">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#C5A059]" />
            <h3 className="text-sm font-semibold text-white">Smart Themes & Appearance</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin scrollbar-thumb-white/10">
          <p className="text-xs text-white/60 leading-relaxed">
            Choose a visual theme tailored for long listening sessions, ambient light conditions, or enable <strong className="text-white">Smart Adaptive</strong> to transition smoothly across morning, sunset, and late night.
          </p>

          {/* Theme Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {themeList.map((theme) => {
              const isSelected = activeTheme === theme.id;
              const isAdaptive = theme.id === 'smart-adaptive';

              return (
                <div
                  key={theme.id}
                  id={`theme-option-${theme.id}`}
                  onClick={() => handleSelectTheme(theme.id)}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#C5A059] bg-white/[0.06] shadow-[0_0_20px_rgba(197,160,89,0.15)]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                  }`}
                >
                  {/* Top Bar with Palette Swatches & Check */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 p-1 rounded-lg bg-black/40 border border-white/10">
                      <div
                        className="w-4 h-4 rounded-full border border-white/20"
                        style={{ backgroundColor: theme.previewColors[0] }}
                      />
                      <div
                        className="w-4 h-4 rounded-full border border-white/20"
                        style={{ backgroundColor: theme.previewColors[1] }}
                      />
                      <div
                        className="w-4 h-4 rounded-full border border-white/20"
                        style={{ backgroundColor: theme.previewColors[2] }}
                      />
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[#C5A059] text-black flex items-center justify-center shadow-md">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white font-serif-display italic tracking-wide">
                        {theme.name}
                      </h4>
                      {isAdaptive && (
                        <span className="text-[9px] font-bold uppercase bg-[#C5A059]/20 text-[#C5A059] px-1.5 py-0.2 rounded-full border border-[#C5A059]/30">
                          Auto
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/50 mt-1 leading-snug">
                      {theme.subtitle}
                    </p>
                  </div>

                  {/* Smart Adaptive Active State Sub-info */}
                  {isAdaptive && isSelected && (
                    <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-[#C5A059] font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Currently Active:
                      </span>
                      <span className="font-bold uppercase">
                        {THEMES[resolvedAdaptive]?.name || 'Adaptive'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.08] bg-[#141414] shrink-0 flex items-center justify-between">
          <span className="text-[11px] text-white/40">
            Selected: <strong className="text-white">{THEMES[activeTheme]?.name}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#C5A059] text-black text-xs font-bold hover:bg-[#d4af65] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
