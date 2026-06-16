import { formatInTimeZone } from "date-fns-tz";

const TZ = "Europe/Berlin";

/** ISO-UTC → "15.01.2024" (Europe/Berlin). */
export function formatDate(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, "dd.MM.yyyy");
}

/** ISO-UTC → "15.01.2024 14:30" (Europe/Berlin). */
export function formatDateTime(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, "dd.MM.yyyy HH:mm");
}

/** ISO-UTC → "14:30" (Europe/Berlin). */
export function formatTime(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, "HH:mm");
}

/** Minuten → "1h 30m" / "2h" / "45m". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
