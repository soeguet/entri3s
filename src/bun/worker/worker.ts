import type { Repository } from "../repository";
import type { GitLabClient } from "../gitlab/types";
import type { AppEmitter } from "../app/emitter";
import type { BookingPayload } from "../service/booking";

const POLL_INTERVAL_MS = 5_000;

async function handleBooking(
  repo: Repository,
  gl: GitLabClient,
  payload: BookingPayload,
): Promise<void> {
  await gl.bookTime(payload.projectId, payload.ticketIid, payload.durationMinutes, payload.note);
  repo.entries.updateStatus(payload.entryId, "booked");
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
    repo.eventQueue.fail(event.id, message);
    if (event.type === "booking") emit.bookingFailed(message);
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
