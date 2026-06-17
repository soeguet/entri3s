import type { Database } from "bun:sqlite";
import { createEntryRepository } from "./entry";
import { createTicketRepository } from "./ticket";
import { createBookingRepository } from "./booking";
import { createTagRepository } from "./tag";
import { createTemplateRepository } from "./template";
import { createEventQueueRepository } from "./event-queue";
import { createScheduleRepository } from "./schedule";
import { createSettingsRepository } from "./settings";

/** Manuelles Wiring aller Repositories. Kein Framework, kein Singleton ausser db. */
export function createRepository(db: Database) {
  return {
    entries: createEntryRepository(db),
    tickets: createTicketRepository(db),
    bookings: createBookingRepository(db),
    tags: createTagRepository(db),
    templates: createTemplateRepository(db),
    eventQueue: createEventQueueRepository(db),
    schedules: createScheduleRepository(db),
    settings: createSettingsRepository(db),
  };
}

export type Repository = ReturnType<typeof createRepository>;
