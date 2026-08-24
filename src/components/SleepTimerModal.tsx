import React, { useState } from 'react';
import { SleepTimerState, SleepTimerOption } from '../types';
import { Moon, X, Clock, Check, Plus, AlertCircle } from 'lucide-react';

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  sleepTimer: SleepTimerState;
  onSetTimer: (option: SleepTimerOption, customMinutes?: number) => void;
  onCancelTimer: () => void;
  onExtendTimer: (minutes: number) => void;
}

export const SleepTimerModal: React.FC<SleepTimerModalProps> = ({
  isOpen,
  onClose,
  sleepTimer,
  onSetTimer,
  onCancelTimer,
  onExtendTimer,
}) => {
  const [customMinutesInput, setCustomMinutesInput] = useState<string>('20');
  const [showCustom, setShowCustom] = useState<boolean>(false);

  if (!isOpen) return null;

  const presets: { label: string; value: SleepTimerOption; sub?: string }[] = [
    { label: '5 min', value: 5 },
    { label: '10 min', value: 10 },
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '45 min', value: 45 },
    { label: '60 min', value: 60 },
    { label: 'End of Chapter', value: 'chapter', sub: 'Stops when current audio track ends' },
  ];

  const formatRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hrs}h ${remainingMins}m ${secs < 10 ? '0' : ''}${secs}s`;
    }
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customMinutesInput, 10);
    if (!isNaN(val) && val > 0 && val <= 360) {
      onSetTimer(val as unknown as SleepTimerOption, val);
      setShowCustom(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        id="sleep-timer-modal"
        className="w-full max-w-sm rounded-3xl bg-[#121212] border border-white/10 shadow-2xl p-6 space-y-5 text-white animate-in zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#C5A059]/10 text-[#C5A059] border border-[#C5A059]/20">
              <Moon className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-base font-serif-display font-semibold italic text-[#E8E8E8]">
                Sleep Timer
              </h3>
              <p className="text-[11px] text-white/50">Auto-fade and stop audio when you drift off</p>
            </div>
          </div>
          <button
            id="btn-close-sleep-timer"
            onClick={onClose}
            className="p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Active Timer Status Banner if running */}
        {sleepTimer.isActive && (
          <div className="p-4 rounded-2xl bg-[#C5A059]/10 border border-[#C5A059]/30 text-center space-y-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#C5A059]">
              Timer Active
            </span>
            <div className="text-3xl font-mono font-bold text-[#E8E8E8] tracking-wider">
              {formatRemaining(sleepTimer.remainingSeconds)}
            </div>
            <p className="text-[11px] text-white/60">
              {sleepTimer.isEndOfChapter ? 'Stopping at end of chapter' : 'Audio will gently fade out in the last 20s'}
            </p>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                id="btn-extend-timer-5m"
                onClick={() => onExtendTimer(5)}
                className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" /> 5 min
              </button>
              <button
                id="btn-extend-timer-15m"
                onClick={() => onExtendTimer(15)}
                className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" /> 15 min
              </button>
              <button
                id="btn-cancel-sleep-timer"
                onClick={onCancelTimer}
                className="px-3 py-1 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-semibold transition-colors"
              >
                Turn Off
              </button>
            </div>
          </div>
        )}

        {/* Presets List */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            Select Duration
          </div>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((preset) => {
              const isSelected =
                sleepTimer.isActive &&
                ((preset.value === 'chapter' && sleepTimer.isEndOfChapter) ||
                  (typeof preset.value === 'number' && Math.round(sleepTimer.totalSeconds / 60) === preset.value));

              return (
                <button
                  key={String(preset.value)}
                  id={`btn-preset-${preset.value}`}
                  onClick={() => {
                    onSetTimer(preset.value);
                    onClose();
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                    preset.value === 'chapter' ? 'col-span-2' : ''
                  } ${
                    isSelected
                      ? 'bg-[#C5A059]/20 border-[#C5A059] text-white'
                      : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.08] text-white/80'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold">{preset.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#C5A059]" />}
                  </div>
                  {preset.sub && <span className="text-[10px] text-white/40 mt-1">{preset.sub}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Timer Input */}
        <div>
          {!showCustom ? (
            <button
              id="btn-show-custom-timer"
              onClick={() => setShowCustom(true)}
              className="w-full py-2.5 rounded-2xl border border-dashed border-white/20 text-xs text-white/60 hover:text-white hover:border-[#C5A059] transition-colors"
            >
              Custom Minutes...
            </button>
          ) : (
            <form onSubmit={handleCustomSubmit} className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="360"
                value={customMinutesInput}
                onChange={(e) => setCustomMinutesInput(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white outline-none focus:border-[#C5A059]"
                placeholder="Minutes"
                autoFocus
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#C5A059] hover:bg-[#d4af65] text-black text-xs font-semibold transition-all"
              >
                Set
              </button>
              <button
                type="button"
                onClick={() => setShowCustom(false)}
                className="p-2 rounded-xl border border-white/10 text-white/40 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
