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

/**
 * Rundet die zu buchende Dauer IMMER auf das nächste volle 15-Minuten-Raster auf.
 * 1 → 15, 15 → 15, 16 → 30, 31 → 45, 90 → 90. Gebucht wird also nie weniger als
 * die tatsächliche Zeit, sondern auf die nächste Viertelstunde aufgerundet.
 */
export function roundUpToQuarterHour(minutes: number): number {
  return Math.ceil(minutes / 15) * 15;
}
