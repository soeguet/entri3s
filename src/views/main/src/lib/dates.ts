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

/**
 * Rundet eine Dauer auf das nächste volle 15-Minuten-Raster auf – spiegelt die
 * Buchungslogik (roundUpToQuarterHour) wider, damit das Form vorab zeigen kann,
 * was später wirklich gebucht würde.
 */
export function roundUpToQuarterHour(minutes: number): number {
  return Math.ceil(minutes / 15) * 15;
}

// ── Komfort-Datumsbereiche für Filter ────────────────────────────────────────

export type RangePreset = "today" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth";

export interface DateRange {
  from: string; // yyyy-MM-dd
  to: string; // yyyy-MM-dd
}

/** Heutiges Datum in Europe/Berlin als "yyyy-MM-dd". */
function berlinTodayYmd(now: Date): string {
  return formatInTimeZone(now, TZ, "yyyy-MM-dd");
}

// Rechnen rein über UTC-Getter, damit das Ergebnis unabhängig von der
// Host-Zeitzone ist. Anker ist das Kalenderdatum in Berlin.
function ymdToUtc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function utcToYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}
function addDays(date: Date, days: number): Date {
  const r = new Date(date);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}
/** Montag der Woche (ISO-Woche, Start Montag). */
function startOfWeek(date: Date): Date {
  const dow = date.getUTCDay(); // 0=So .. 6=Sa
  return addDays(date, -((dow + 6) % 7));
}

/** Datumsbereich (yyyy-MM-dd) für ein Preset, Anker ist heute in Berlin. */
export function rangeForPreset(preset: RangePreset, now: Date = new Date()): DateRange {
  const today = ymdToUtc(berlinTodayYmd(now));
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();

  switch (preset) {
    case "today":
      return { from: utcToYmd(today), to: utcToYmd(today) };
    case "thisWeek": {
      const start = startOfWeek(today);
      return { from: utcToYmd(start), to: utcToYmd(addDays(start, 6)) };
    }
    case "lastWeek": {
      const start = addDays(startOfWeek(today), -7);
      return { from: utcToYmd(start), to: utcToYmd(addDays(start, 6)) };
    }
    case "thisMonth":
      return {
        from: utcToYmd(new Date(Date.UTC(y, m, 1))),
        to: utcToYmd(new Date(Date.UTC(y, m + 1, 0))),
      };
    case "lastMonth":
      return {
        from: utcToYmd(new Date(Date.UTC(y, m - 1, 1))),
        to: utcToYmd(new Date(Date.UTC(y, m, 0))),
      };
  }
}
