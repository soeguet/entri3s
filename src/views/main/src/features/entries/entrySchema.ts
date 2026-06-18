import { z } from "zod";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { Entry, EntryCreate } from "../../../../../shared/types";

const TZ = "Europe/Berlin";

export const entrySchema = z
  .object({
    date: z.string().min(1, "Datum ist erforderlich"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Startzeit fehlt"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Endzeit fehlt"),
    notes: z.string(),
    tagIds: z.array(z.number()),
    ticketId: z.number().nullable(),
  })
  .refine((v) => toMinutes(v.endTime) > toMinutes(v.startTime), {
    message: "Ende muss nach Start liegen",
    path: ["endTime"],
  });

export type EntryFormValues = z.infer<typeof entrySchema>;

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Live-Vorschau der Dauer fürs Form. null = ungültig (Ende ≤ Start). */
export function previewDurationMinutes(startTime: string, endTime: string): number | null {
  const re = /^\d{2}:\d{2}$/;
  if (!re.test(startTime) || !re.test(endTime)) return null;
  const diff = toMinutes(endTime) - toMinutes(startTime);
  return diff > 0 ? diff : null;
}

function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Form-Werte (Europe/Berlin) → EntryCreate (UTC). */
export function toEntryCreate(values: EntryFormValues): EntryCreate {
  const start = fromZonedTime(`${values.date}T${values.startTime}:00`, TZ);
  const durationMinutes = toMinutes(values.endTime) - toMinutes(values.startTime);
  return {
    notes: values.notes.trim() === "" ? null : values.notes.trim(),
    durationMinutes,
    date: start.toISOString(),
    status: "draft",
    tagIds: values.tagIds,
    ticketIds: values.ticketId === null ? [] : [values.ticketId],
  };
}

/** Entry (UTC) → Form-Werte (Europe/Berlin). */
export function toFormValues(entry: Entry): EntryFormValues {
  const startMinutes = toMinutes(formatInTimeZone(entry.date, TZ, "HH:mm"));
  return {
    date: formatInTimeZone(entry.date, TZ, "yyyy-MM-dd"),
    startTime: formatInTimeZone(entry.date, TZ, "HH:mm"),
    endTime: minutesToTime(startMinutes + entry.durationMinutes),
    notes: entry.notes ?? "",
    tagIds: entry.tagIds,
    ticketId: entry.ticketIds[0] ?? null,
  };
}

/**
 * Ersetzt das Kalenderdatum eines Entries (ymd = "yyyy-MM-dd"), erhält die
 * Berliner Ortszeit (Start-Uhrzeit). DST-sicher via fromZonedTime. Liefert ISO-UTC.
 */
export function withDate(entry: Entry, ymd: string): string {
  const hhmm = formatInTimeZone(entry.date, TZ, "HH:mm");
  return fromZonedTime(`${ymd}T${hhmm}:00`, TZ).toISOString();
}

export const emptyFormValues: EntryFormValues = {
  date: formatInTimeZone(new Date(), TZ, "yyyy-MM-dd"),
  startTime: "09:00",
  endTime: "10:00",
  notes: "",
  tagIds: [],
  ticketId: null,
};
