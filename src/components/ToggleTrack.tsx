import React from 'react';

/** Shared ON/OFF control so every settings switch has the same proportions. */
export const ToggleTrack: React.FC<{ checked: boolean }> = ({ checked }) => (
  <span className="inline-flex shrink-0 items-center gap-2" aria-hidden="true">
    <span className={`w-7 text-right text-[9px] font-bold tracking-wider ${checked ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'}`}>
      {checked ? 'ON' : 'OFF'}
    </span>
    <span className={`relative inline-flex h-6 w-11 items-center rounded-full border p-0.5 transition-colors ${checked ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--border-subtle)] bg-[var(--surface-raised)]'}`}>
      <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </span>
  </span>
);
