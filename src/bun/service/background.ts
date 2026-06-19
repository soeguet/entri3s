import type { Repository } from "../repository";
import type { BackgroundStatus, ScheduleStatus } from "../../shared/types";
import type { SyncService } from "./sync";

/**
 * Aggregiert den read-only Status aller Hintergrundprozesse (Sync, Schedules,
 * Event-Queue) für die UI-Anzeige. Keine Steuerung — reine Momentaufnahme.
 */
export function createBackgroundService(repo: Repository, sync: SyncService) {
  return {
    getStatus(): BackgroundStatus {
      const schedules: ScheduleStatus[] = repo.schedules.list().map((s) => ({
        name: s.name,
        intervalSec: s.intervalSec,
        lastRunAt: s.lastRun,
        nextRunAt: s.lastRun
          ? new Date(new Date(s.lastRun).getTime() + s.intervalSec * 1000).toISOString()
          : null,
      }));

      return {
        syncRunning: sync.isSyncing(),
        schedules,
        queue: repo.eventQueue.counts(),
      };
    },
  };
}

export type BackgroundService = ReturnType<typeof createBackgroundService>;
