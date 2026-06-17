import type { ApiClient } from "./client";
import type { GitLabBookingResult } from "./types";
import { formatDuration } from "./format";

/** Buchungsnotizen werden bei 255 Zeichen gekappt (Produktentscheidung). */
export const MAX_NOTE_LENGTH = 255;

/**
 * Unsichtbarer Idempotenz-Marker, eindeutig pro Entry. Steckt als HTML-Kommentar
 * im Note-Body (in GitLab nicht gerendert) und erlaubt es, eine bereits
 * erfolgte Buchung wiederzufinden — Schutz gegen Doppelbuchung bei Retry.
 */
export function bookingMarker(entryId: number): string {
  return `<!-- entries-booking:entry=${entryId} -->`;
}

interface NoteResponse {
  id: number;
  created_at: string;
}

interface NoteListItem {
  id: number;
  created_at: string;
  body: string;
}

/**
 * Bucht Zeit auf ein Issue über die Notes-API mit der `/spend` Quick Action.
 * Anders als `add_spent_time` (REST) erlaubt `/spend <dauer> <datum>` ein frei
 * wählbares Buchungsdatum. Der Entry-Text wird unter die Quick Action gehängt,
 * damit die Notiz auf dem Ticket sichtbar bleibt; der Idempotenz-Marker macht
 * die Buchung wiederauffindbar. Rückgabe ist die note_id als Rückreferenz.
 */
export async function bookTime(
  client: ApiClient,
  projectId: number,
  issueIid: number,
  durationMinutes: number,
  spentAt: string,
  note: string,
  marker: string,
): Promise<GitLabBookingResult> {
  const duration = formatDuration(durationMinutes);
  const lines = [`/spend ${duration} ${spentAt}`];
  const text = note.trim().slice(0, MAX_NOTE_LENGTH);
  if (text) lines.push("", text);
  lines.push("", marker); // immer ein persistenter Body → Note existiert & ist auffindbar

  const res = await client.apiRequest(`/projects/${projectId}/issues/${issueIid}/notes`, {
    method: "POST",
    body: JSON.stringify({ body: lines.join("\n") }),
  });
  const data = (await res.json()) as NoteResponse;
  return { noteId: data.id, createdAt: data.created_at };
}

/**
 * Sucht eine bereits existierende Buchungs-Note anhand des Markers. Wird vor
 * jedem `/spend` aufgerufen: existiert die Note schon (z.B. weil ein vorheriger
 * Versuch nach dem API-Call abbrach), darf NICHT erneut gebucht werden.
 */
export async function findBookingNote(
  client: ApiClient,
  projectId: number,
  issueIid: number,
  marker: string,
): Promise<GitLabBookingResult | null> {
  let page = 1;
  while (true) {
    const params = new URLSearchParams({ per_page: "100", page: String(page) });
    const res = await client.apiRequest(
      `/projects/${projectId}/issues/${issueIid}/notes?${params}`,
    );
    const notes = (await res.json()) as NoteListItem[];
    const hit = notes.find((n) => n.body?.includes(marker));
    if (hit) return { noteId: hit.id, createdAt: hit.created_at };

    const totalPages = Number(res.headers.get("x-total-pages") ?? 1);
    if (page >= totalPages) break;
    page++;
  }
  return null;
}
