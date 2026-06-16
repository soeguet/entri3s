import type { Database } from "bun:sqlite";
import type { Repository } from "../repository";
import type { GitLabClient } from "../gitlab/types";
import { createEntryService } from "./entry";
import { createSyncService } from "./sync";
import { createBookingService } from "./booking";
import { createTagService } from "./tag";
import { createTemplateService } from "./template";
import { createTicketService } from "./ticket";
import { createEventService } from "./events";
import { createSettingsService } from "./settings";

export function createService(repo: Repository, gl: GitLabClient, db: Database) {
  return {
    entry: createEntryService(repo),
    sync: createSyncService(repo, gl),
    booking: createBookingService(repo),
    tag: createTagService(repo),
    template: createTemplateService(repo),
    ticket: createTicketService(repo),
    events: createEventService(repo),
    settings: createSettingsService(repo, db),
  };
}

export type Services = ReturnType<typeof createService>;
