/**
 * Dauer in Minuten → GitLab-Zeitformat.
 * 0 → "0h", 30 → "0h 30m", 60 → "1h", 90 → "1h 30m", 120 → "2h"
 */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
