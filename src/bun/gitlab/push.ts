import type { ApiClient } from "./client";
import type { GitLabBookingResult } from "./types";
import { formatDuration } from "./format";

/** GitLab schluckt nur 255 Zeichen Notiztext pro Buchung — länger wird gekappt. */
export const MAX_NOTE_LENGTH = 255;

interface NoteResponse {
  id: number;
  created_at: string;
}

/**
 * Bucht Zeit auf ein Issue über die Notes-API mit der `/spend` Quick Action.
 * Anders als `add_spent_time` (REST) erlaubt `/spend <dauer> <datum>` ein frei
 * wählbares Buchungsdatum. Der Entry-Text wird unter die Quick Action gehängt,
 * damit die Notiz auf dem Ticket sichtbar bleibt (Abweichung von der Spec, die
 * eine reine System-Note ohne Kommentar vorsah — bewusst, da der Text gewünscht
 * ist). Rückgabe ist die note_id als Rückreferenz für die bookings-Tabelle.
 */
export async function bookTime(
  client: ApiClient,
  projectId: number,
  issueIid: number,
  durationMinutes: number,
  spentAt: string,
  note: string,
): Promise<GitLabBookingResult> {
  const duration = formatDuration(durationMinutes);
  const lines = [`/spend ${duration} ${spentAt}`];
  const text = note.trim().slice(0, MAX_NOTE_LENGTH);
  if (text) lines.push("", text);

  const res = await client.apiRequest(`/projects/${projectId}/issues/${issueIid}/notes`, {
    method: "POST",
    body: JSON.stringify({ body: lines.join("\n") }),
  });
  const data = (await res.json()) as NoteResponse;
  return { noteId: data.id, createdAt: data.created_at };
}
