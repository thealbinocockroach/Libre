export interface HSB {
  h: number; // 0-360
  s: number; // 0-100
  b: number; // 0-100
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const int = parseInt(h, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')).join('');
}

export function hexToHsb(hex: string): HSB {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : Math.round((d / max) * 100);
  const v = Math.round(max * 100);
  return { h, s, b: v };
}

export function hsbToHex(hsb: HSB): string {
  const { h, s, b } = hsb;
  const sn = s / 100, vn = b / 100;
  const c = vn * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vn - c;
  let rn = 0, gn = 0, bn = 0;
  if (h < 60) { rn = c; gn = x; }
  else if (h < 120) { rn = x; gn = c; }
  else if (h < 180) { gn = c; bn = x; }
  else if (h < 240) { gn = x; bn = c; }
  else if (h < 300) { rn = x; bn = c; }
  else { rn = c; bn = x; }
  return rgbToHex((rn + m) * 255, (gn + m) * 255, (bn + m) * 255);
}

export function hexToRgbString(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `${r}, ${g}, ${b}`;
}

/* ------------------------------------------------------------------ *
 * Curated palette presets
 * ------------------------------------------------------------------ */

export interface PalettePreset {
  id: string;
  name: string;
  bg: string;
  surface: string;
  accent: string;
  textMain: string;
}

export const PALETTE_PRESETS: PalettePreset[] = [
  // Dark
  { id: 'midnight-gold', name: 'Midnight Gold', bg: '#050505', surface: '#111111', accent: '#C5A059', textMain: '#EFEFEF' },
  { id: 'ocean-depths', name: 'Ocean Depths', bg: '#060d18', surface: '#0c1825', accent: '#38BDF8', textMain: '#E0F0FF' },
  { id: 'neon-noir', name: 'Neon Noir', bg: '#050508', surface: '#0d0d15', accent: '#A78BFA', textMain: '#EDE9FE' },
  { id: 'forest-night', name: 'Forest Night', bg: '#060f0a', surface: '#0f1e16', accent: '#34D399', textMain: '#E2F5EC' },
  { id: 'crimson-dusk', name: 'Crimson Dusk', bg: '#100608', surface: '#1c0e12', accent: '#FB7185', textMain: '#FFE4E6' },
  // Light
  { id: 'arctic-frost', name: 'Arctic Frost', bg: '#F0F4F8', surface: '#E2E8F0', accent: '#1E40AF', textMain: '#1A202C' },
  { id: 'lavender-mist', name: 'Lavender Mist', bg: '#F5F0FA', surface: '#E8DEEF', accent: '#7C3AED', textMain: '#1F1235' },
  { id: 'rose-garden', name: 'Rose Garden', bg: '#FFF1F2', surface: '#FFE4E6', accent: '#BE123C', textMain: '#1C0A10' },
  { id: 'sage-paper', name: 'Sage Paper', bg: '#F5F7F0', surface: '#E8ECE0', accent: '#4D7C0F', textMain: '#1A1F14' },
  // Vibrant
  { id: 'cyberpunk', name: 'Cyberpunk', bg: '#0A0A12', surface: '#12121F', accent: '#06B6D4', textMain: '#E0F2FE' },
  { id: 'sunset-blaze', name: 'Sunset Blaze', bg: '#120A06', surface: '#1F1208', accent: '#F97316', textMain: '#FFF7ED' },
  { id: 'tropical-reef', name: 'Tropical Reef', bg: '#060E14', surface: '#0C1A24', accent: '#0EA5E9', textMain: '#E0F2FE' },
  { id: 'aurora', name: 'Aurora', bg: '#06080F', surface: '#0E1220', accent: '#8B5CF6', textMain: '#EDE9FE' },
  // Warm
  { id: 'cinnamon', name: 'Cinnamon', bg: '#0F0A06', surface: '#1A1308', accent: '#D97706', textMain: '#FEF3C7' },
  { id: 'terracotta', name: 'Terracotta', bg: '#0D0806', surface: '#1A110C', accent: '#C2410C', textMain: '#FFF7ED' },
  { id: 'amber-glow', name: 'Amber Glow', bg: '#0C0A04', surface: '#181408', accent: '#F59E0B', textMain: '#FFFBEB' },
  // Cool
  { id: 'steel-blue', name: 'Steel Blue', bg: '#080C12', surface: '#101824', accent: '#3B82F6', textMain: '#DBEAFE' },
  { id: 'slate-mono', name: 'Slate Mono', bg: '#0C0E10', surface: '#181C20', accent: '#94A3B8', textMain: '#F1F5F9' },
  { id: 'ice-crystal', name: 'Ice Crystal', bg: '#F8FAFC', surface: '#E8ECF0', accent: '#0284C7', textMain: '#0F172A' },
  { id: 'emerald-dark', name: 'Emerald Dark', bg: '#04100C', surface: '#0A1E16', accent: '#10B981', textMain: '#D1FAE5' },
];
