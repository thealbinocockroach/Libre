/**
 * Parse a time string in "HH:MM:SS", "MM:SS", "HH:MM:SS.ss", or raw seconds to total seconds.
 * Used by both audioQualityManager and librivoxRecommendations.
 */
export function parseTimeString(runtime?: string | number): number {
  if (typeof runtime === 'number') return Math.round(runtime) || 0;
  if (!runtime || typeof runtime !== 'string') return 0;

  const trimmed = runtime.trim();
  if (!trimmed) return 0;

  // Already a plain number
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(parseFloat(trimmed)) || 0;

  const parts = trimmed.split(':');
  if (parts.length > 3) return 0;

  // Handle decimal seconds: "16:31.09" or "1:23:45.67"
  const lastPart = parseFloat(parts[parts.length - 1]);
  if (isNaN(lastPart)) return 0;

  const intParts = parts.map((p) => parseInt(p, 10));
  if (intParts.some(isNaN)) return 0;

  if (parts.length === 3) {
    return intParts[0] * 3600 + intParts[1] * 60 + Math.round(lastPart);
  }
  if (parts.length === 2) {
    return intParts[0] * 60 + Math.round(lastPart);
  }
  return 0;
}
