import type { Database } from "bun:sqlite";
import type { Repository } from "../repository";
import type { GitLabClient } from "../gitlab/types";
import type { AppEmitter } from "../app/emitter";
import { createEntryService } from "./entry";
import { createSyncService } from "./sync";
import { createBookingService } from "./booking";
import { createTagService } from "./tag";
import { createTemplateService } from "./template";
import { createTicketService } from "./ticket";
import { createProjectService } from "./project";
import { createEventService } from "./events";
import { createSettingsService } from "./settings";

export function createService(repo: Repository, gl: GitLabClient, db: Database, emit: AppEmitter) {
  return {
    entry: createEntryService(repo),
    sync: createSyncService(repo, gl, emit),
    booking: createBookingService(repo),
    tag: createTagService(repo),
    template: createTemplateService(repo),
    ticket: createTicketService(repo),
    project: createProjectService(repo),
    events: createEventService(repo),
    settings: createSettingsService(repo, db),
  };
}

export type Services = ReturnType<typeof createService>;
