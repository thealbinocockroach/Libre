/**
 * Parse a time string in "HH:MM:SS", "MM:SS", or raw seconds to total seconds.
 * Used by both audioQualityManager and librivoxRecommendations.
 */
export function parseTimeString(runtime?: string | number): number {
  if (typeof runtime === 'number') return Math.round(runtime) || 0;
  if (!runtime || typeof runtime !== 'string') return 0;

  const trimmed = runtime.trim();
  if (!trimmed) return 0;

  // Already a plain number
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(parseFloat(trimmed)) || 0;

  const parts = trimmed.split(':').map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}
