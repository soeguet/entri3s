import type { Repository } from "../repository";
import type { GitLabClient } from "../gitlab/types";
import type { AppEmitter } from "../app/emitter";
import type { BookingPayload } from "../service/booking";
import { bookingMarker } from "../gitlab/push";

const POLL_INTERVAL_MS = 5_000;

async function handleBooking(
  repo: Repository,
  gl: GitLabClient,
  payload: BookingPayload,
): Promise<void> {
  // Doppelbuchungs-Schutz: `/spend` ist additiv und nicht idempotent. Brach ein
  // vorheriger Versuch nach dem API-Call ab (DB-Fehler, verlorene Response,
  // Crash), liegt die Note bereits in GitLab. Vor jedem Buchen prüfen, ob die
  // Note mit unserem Entry-Marker schon existiert — wenn ja, NICHT erneut buchen.
  const marker = bookingMarker(payload.entryId);
  const existing = await gl.findBookingNote(payload.projectId, payload.ticketIid, marker);
  const result =
    existing ??
    (await gl.bookTime(
      payload.projectId,
      payload.ticketIid,
      payload.durationMinutes,
      payload.spentAt,
      payload.note,
      marker,
    ));

  // Booking-Record idempotent schreiben (UNIQUE auf note_id + Vorab-Check).
  if (!repo.bookings.getByNoteId(result.noteId, payload.projectId)) {
    repo.bookings.create({
      entryId: payload.entryId,
      ticketId: payload.ticketId,
      gitlabNoteId: result.noteId,
      projectId: payload.projectId,
      issueIid: payload.ticketIid,
      durationMinutes: payload.durationMinutes,
      note: payload.note,
      spentAt: payload.spentAt,
    });
  }
  repo.entries.updateStatus(payload.entryId, "booked");
}

/** Entry eines dead-gelaufenen Booking-Events auf 'booking_failed' setzen. */
function markBookingFailed(repo: Repository, rawPayload: string): void {
  try {
    const payload = JSON.parse(rawPayload) as BookingPayload;
    repo.entries.updateStatus(payload.entryId, "booking_failed");
  } catch {
    // Defekter Payload — kein Entry zu markieren. Das Event bleibt 'dead'.
  }
}

/**
 * Verarbeitet genau ein Event aus der Queue. Gibt false zurück, wenn die Queue
 * leer war. Exportiert für Tests.
 */
export async function processNext(
  repo: Repository,
  gl: GitLabClient,
  emit: AppEmitter,
): Promise<boolean> {
  const event = repo.eventQueue.claimNext();
  if (!event) return false;

  try {
    if (event.type === "booking") {
      await handleBooking(repo, gl, JSON.parse(event.payload) as BookingPayload);
    }
    repo.eventQueue.complete(event.id);
    if (event.type === "booking") emit.bookingCompleted();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = repo.eventQueue.fail(event.id, message);
    if (event.type === "booking") {
      // Dead-Letter (alle Retries verbraucht): Entry in terminalen Fehlerzustand
      // versetzen, damit das UI nicht ewig "Buchung läuft" zeigt. Bei normalen
      // Retries bleibt der Entry auf 'pending_booking'.
      if (status === "dead") markBookingFailed(repo, event.payload);
      emit.bookingFailed(message);
    }
  }
  return true;
}

/** Pollt die event_queue alle 5s und verarbeitet alle pending Events sequentiell. */
export function startWorker(repo: Repository, gl: GitLabClient, emit: AppEmitter): Timer {
  let isProcessing = false;

  async function tick(): Promise<void> {
    if (isProcessing) return;
    isProcessing = true;
    try {
      while (await processNext(repo, gl, emit)) {
        // weiterverarbeiten bis Queue leer
      }
    } finally {
      isProcessing = false;
    }
  }

  return setInterval(tick, POLL_INTERVAL_MS);
}
