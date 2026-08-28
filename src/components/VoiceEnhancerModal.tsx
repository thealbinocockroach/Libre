import React from 'react';
import { VoiceEnhancerPreset } from '../types';
import { Sliders, X, Sparkles, Check, Volume2, ShieldCheck, Activity } from 'lucide-react';

interface VoiceEnhancerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPreset: VoiceEnhancerPreset;
  onSelectPreset: (preset: VoiceEnhancerPreset) => void;
}

export const VoiceEnhancerModal: React.FC<VoiceEnhancerModalProps> = ({
  isOpen,
  onClose,
  currentPreset,
  onSelectPreset,
}) => {
  if (!isOpen) return null;

  const presets: {
    id: VoiceEnhancerPreset;
    title: string;
    description: string;
    tag: string;
    curve: number[]; // relative bar heights for visual EQ
  }[] = [
    {
      id: 'voice_boost',
      title: 'Voice Clarity (Dialogue Boost)',
      description: 'Peaking filter at 2.4kHz to lift narrator vocal timbre and make dialogue pop clearly.',
      tag: 'Recommended for LibriVox',
      curve: [25, 35, 80, 95, 75, 40],
    },
    {
      id: 'noise_reduce',
      title: 'Vintage De-Hiss & Noise Reduce',
      description: 'Smooth lowpass roll-off above 5.5kHz to eliminate background tape hiss & microphone static.',
      tag: 'Best for Vintage Audio',
      curve: [40, 50, 60, 50, 20, 10],
    },
    {
      id: 'bass_warmth',
      title: 'Warm Radio Broadcast',
      description: 'Deep resonant low-shelf at 200Hz for rich, velvet baritone audiobook narration.',
      tag: 'Warm Atmosphere',
      curve: [85, 75, 50, 40, 35, 30],
    },
    {
      id: 'clarity',
      title: 'Crisp High-Shelf Clarity',
      description: 'Brilliant highs at 4kHz to brighten muffled or low-bitrate historical recordings.',
      tag: 'Bright & Crisp',
      curve: [30, 40, 50, 70, 85, 90],
    },
    {
      id: 'off',
      title: 'Bypass (Natural Studio)',
      description: 'Direct unfiltered flat master output without Web Audio equalization.',
      tag: 'Flat Standard',
      curve: [40, 40, 40, 40, 40, 40],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        id="voice-enhancer-modal"
        className="w-full max-w-md rounded-3xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] shadow-2xl p-6 space-y-5 text-[var(--text-main)] animate-in zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent-dim)]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-serif-display font-semibold italic text-[var(--text-main)]">
                  Vocal Equalizer & Clarity
                </h3>
                <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-[var(--accent-dim)] text-[var(--accent)]">
                  Web Audio EQ
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-dim)]">Engineered specifically for LibriVox recordings</p>
            </div>
          </div>
          <button
            id="btn-close-enhancer"
            onClick={onClose}
            className="p-1.5 rounded-full text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface-raised)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preset Cards List */}
        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
          {presets.map((preset) => {
            const isSelected = currentPreset === preset.id;
            return (
              <button
                key={preset.id}
                id={`btn-preset-eq-${preset.id}`}
                onClick={() => {
                  onSelectPreset(preset.id);
                }}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3.5 ${
                  isSelected
                    ? 'bg-[var(--accent-dim)] border-[var(--accent)] ring-1 ring-[var(--accent)] text-[var(--text-main)]'
                    : 'bg-[var(--surface-raised)] border-[var(--border-subtle)] hover:bg-[var(--surface-raised)] text-[var(--text-main)]'
                }`}
              >
                {/* Visual EQ Spectrum Graph for this preset */}
                <div className="w-12 h-10 rounded-lg bg-black/40 border border-[var(--border-subtle)] flex items-end justify-between p-1.5 gap-0.5 shrink-0 mt-0.5">
                  {preset.curve.map((val, idx) => (
                    <div
                      key={idx}
                      className={`w-1.5 rounded-full transition-all duration-300 ${
                        isSelected ? 'bg-[var(--accent)]' : 'bg-[var(--surface-raised)]'
                      }`}
                      style={{ height: `${val}%` }}
                    />
                  ))}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold truncate text-[var(--text-main)]">{preset.title}</span>
                    <span
                      className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'bg-[var(--surface-raised)] text-[var(--text-dim)]'
                      }`}
                    >
                      {preset.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">{preset.description}</p>
                </div>

                {isSelected && (
                  <div className="p-1 rounded-full bg-[var(--accent)] text-[var(--on-accent)] shrink-0 self-center">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Info Footer */}
        <div className="pt-2 text-center text-[11px] text-[var(--text-dim)] flex items-center justify-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>Real-time Biquad DSP filter processing</span>
        </div>
      </div>
    </div>
  );
};
