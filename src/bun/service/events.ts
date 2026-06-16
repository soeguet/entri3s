import type { AppEvent } from "../../shared/types";
import type { Repository } from "../repository";

export function createEventService(repo: Repository) {
  return {
    getDead(): AppEvent[] {
      return repo.eventQueue.listDead();
    },
    retryDead(eventId: number): void {
      repo.eventQueue.retryDead(eventId);
    },
  };
}

export type EventService = ReturnType<typeof createEventService>;
