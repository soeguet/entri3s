import type { AppEvent } from "../../shared/types";
import type { Repository } from "../repository";
import type { BookingPayload } from "./booking";

export function createEventService(repo: Repository) {
  return {
    getDead(): AppEvent[] {
      return repo.eventQueue.listDead();
    },
    retryDead(eventId: number): void {
      // Vor dem Reset des Events den Entry zurücksetzen: Ein dead-gelaufenes
      // Booking hat den Entry auf 'booking_failed' gesetzt. Damit der Worker es
      // sauber neu bucht, muss der Entry wieder auf 'pending_booking'. Andere
      // Event-Typen haben keinen Entry und werden generisch nur neu eingereiht.
      const dead = repo.eventQueue.getDeadById(eventId);
      if (dead && dead.type === "booking") {
        try {
          const payload = JSON.parse(dead.payload) as BookingPayload;
          repo.entries.updateStatus(payload.entryId, "pending_booking");
        } catch {
          // Defekter Payload — nur das Event neu einreihen.
        }
      }
      repo.eventQueue.retryDead(eventId);
    },
    discardDead(eventId: number): void {
      // Verwerfen lässt den lokalen Booking-Record bewusst unangetastet: der Nutzer
      // entfernt nur das hängende Event aus der Liste, nicht die zugrunde liegende
      // Buchung. Das eigentliche Stornieren läuft über deleteBooking.
      repo.eventQueue.discardDead(eventId);
    },
  };
}

export type EventService = ReturnType<typeof createEventService>;
