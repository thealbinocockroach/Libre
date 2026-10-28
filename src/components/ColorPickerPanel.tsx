import React, { useRef, useCallback, useEffect, useState } from 'react';
import { hexToHsb, hsbToHex, HSB } from '../utils/colorPickerUtils';

interface ColorPickerPanelProps {
  color: string;
  onChange: (hex: string) => void;
}

export const ColorPickerPanel: React.FC<ColorPickerPanelProps> = ({ color, onChange }) => {
  const [hsb, setHsb] = useState<HSB>(() => hexToHsb(color));
  const [hexInput, setHexInput] = useState(color);
  const squareRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'square' | 'hue' | null>(null);

  useEffect(() => {
    const h = hexToHsb(color);
    setHsb(h);
    setHexInput(color);
  }, [color]);

  const emit = useCallback(
    (next: HSB) => {
      setHsb(next);
      const hex = hsbToHex(next);
      setHexInput(hex);
      onChange(hex);
    },
    [onChange],
  );

  const pickSquare = useCallback(
    (clientX: number, clientY: number) => {
      const el = squareRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clamp((clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((clientY - rect.top) / rect.height, 0, 1);
      emit({ h: hsb.h, s: Math.round(x * 100), b: Math.round((1 - y) * 100) });
    },
    [hsb.h, emit],
  );

  const pickHue = useCallback(
    (clientX: number) => {
      const el = hueRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clamp((clientX - rect.left) / rect.width, 0, 1);
      emit({ ...hsb, h: Math.round(x * 360) });
    },
    [hsb, emit],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      const pt = 'touches' in e ? e.touches[0] : e;
      if (dragging.current === 'square') pickSquare(pt.clientX, pt.clientY);
      else pickHue(pt.clientX);
    };
    const onUp = () => { dragging.current = null; };
    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [pickSquare, pickHue]);

  const hueColor = hsbToHex({ h: hsb.h, s: 100, b: 100 });

  // Saturation/Brightness crosshair position
  const cx = (hsb.s / 100) * 100;
  const cy = (1 - hsb.b / 100) * 100;

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Saturation / Brightness square */}
      <div
        ref={squareRef}
        className="relative w-full aspect-square rounded-xl overflow-hidden cursor-crosshair border border-[var(--border-subtle)] select-none"
        style={{ backgroundColor: hueColor }}
        onMouseDown={(e) => { dragging.current = 'square'; pickSquare(e.clientX, e.clientY); }}
        onTouchStart={(e) => { dragging.current = 'square'; const t = e.touches[0]; pickSquare(t.clientX, t.clientY); }}
      >
        {/* White → Hue gradient (saturation axis) */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #fff, transparent)' }} />
        {/* Transparent → Black gradient (brightness axis) */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent, #000)' }} />
        {/* Crosshair */}
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `${cx}%`, top: `${cy}%`, boxShadow: '0 0 0 1.5px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.4)' }}
        />
      </div>

      {/* Hue slider */}
      <div
        ref={hueRef}
        className="relative w-full h-4 rounded-full cursor-pointer select-none border border-[var(--border-subtle)]"
        style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
        onMouseDown={(e) => { dragging.current = 'hue'; pickHue(e.clientX); }}
        onTouchStart={(e) => { dragging.current = 'hue'; const t = e.touches[0]; pickHue(t.clientX); }}
      >
        <div
          className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-white -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            left: `${(hsb.h / 360) * 100}%`,
            backgroundColor: hueColor,
            boxShadow: '0 0 0 1.5px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.3)',
          }}
        />
      </div>

      {/* Hex input + preview */}
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg border border-[var(--border-subtle)] shrink-0"
          style={{ backgroundColor: hsbToHex(hsb) }}
        />
        <input
          type="text"
          value={hexInput}
          onChange={(e) => {
            const v = e.target.value;
            setHexInput(v);
            if (/^#[0-9a-fA-F]{6}$/.test(v)) {
              setHsb(hexToHsb(v));
              onChange(v);
            }
          }}
          onBlur={() => {
            if (/^#[0-9a-fA-F]{6}$/.test(hexInput)) {
              const h = hexToHsb(hexInput);
              setHsb(h);
              onChange(hexInput);
            } else {
              setHexInput(hsbToHex(hsb));
            }
          }}
          className="flex-1 px-2 py-1.5 rounded-lg bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-main)] outline-none focus:border-[var(--accent)] transition-colors"
          placeholder="#000000"
          maxLength={7}
        />
      </div>
    </div>
  );
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
