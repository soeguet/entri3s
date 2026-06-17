import type { Repository } from "../repository";
import type { GitLabClient, TimelogTarget } from "../gitlab/types";
import type { AppEmitter } from "../app/emitter";
import type { BookingPayload, BookingDeletePayload } from "../service/booking";

const POLL_INTERVAL_MS = 5_000;

/** Buchungs-Events (Anlegen und Stornieren) lösen dieselben UI-Refresh-Events aus. */
function isBookingEvent(type: string): boolean {
  return type === "booking" || type === "booking_delete";
}

async function handleBooking(
  repo: Repository,
  gl: GitLabClient,
  payload: BookingPayload,
): Promise<void> {
  const target: TimelogTarget = {
    projectId: payload.projectId,
    issueIid: payload.ticketIid,
    issueGlobalId: payload.issueGlobalId,
  };

  // Doppelbuchungs-Schutz: timelogCreate ist nicht idempotent. Brach ein
  // vorheriger Versuch nach dem API-Call ab (DB-Fehler, verlorene Response,
  // Crash), liegt der Timelog bereits in GitLab. Vor dem Buchen nach einem
  // identischen Timelog suchen (best-effort: scheitert die Query, wird trotzdem
  // gebucht — eine etwaige Doppelbuchung lässt sich per deleteBooking korrigieren).
  let timelogId: number | null = null;
  try {
    timelogId = await gl.findTimelog(
      target,
      payload.durationMinutes,
      payload.spentAt,
      payload.note,
    );
  } catch {
    timelogId = null;
  }
  timelogId ??= await gl.createTimelog(
    target,
    payload.durationMinutes,
    payload.spentAt,
    payload.note,
  );

  // Booking-Record idempotent schreiben (UNIQUE auf timelog_id + Vorab-Check).
  if (!repo.bookings.getByTimelogId(timelogId, payload.projectId)) {
    repo.bookings.create({
      entryId: payload.entryId,
      ticketId: payload.ticketId,
      gitlabTimelogId: timelogId,
      projectId: payload.projectId,
      issueIid: payload.ticketIid,
      durationMinutes: payload.durationMinutes,
      note: payload.note,
      spentAt: payload.spentAt,
    });
  }
  repo.entries.updateStatus(payload.entryId, "booked");
}

async function handleBookingDelete(
  repo: Repository,
  gl: GitLabClient,
  payload: BookingDeletePayload,
): Promise<void> {
  const booking = repo.bookings.getById(payload.bookingId);
  if (!booking) return; // bereits gelöscht (Retry nach Erfolg) → nichts zu tun

  // Erst remote löschen, dann lokal: schlägt das remote-Delete fehl, bleibt der
  // lokale Record erhalten und das Event wird erneut versucht.
  await gl.deleteTimelog(booking.gitlabTimelogId);
  repo.bookings.delete(booking.id);

  // Entry wieder buchbar machen, sofern keine weitere Buchung mehr existiert.
  if (repo.bookings.listByEntry(booking.entryId).length === 0) {
    repo.entries.updateStatus(booking.entryId, "draft");
  }
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
    } else if (event.type === "booking_delete") {
      await handleBookingDelete(repo, gl, JSON.parse(event.payload) as BookingDeletePayload);
    }
    repo.eventQueue.complete(event.id);
    if (isBookingEvent(event.type)) emit.bookingCompleted();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = repo.eventQueue.fail(event.id, message);
    if (isBookingEvent(event.type)) {
      // Dead-Letter (alle Retries verbraucht): Entry in terminalen Fehlerzustand
      // versetzen, damit das UI nicht ewig "Buchung läuft" zeigt. Bei normalen
      // Retries bleibt der Entry auf 'pending_booking'. (Nur für 'booking' relevant —
      // 'booking_delete' lässt den Entry-Status unangetastet.)
      if (status === "dead" && event.type === "booking") markBookingFailed(repo, event.payload);
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
