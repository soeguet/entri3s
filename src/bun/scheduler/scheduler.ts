import type { Repository } from "../repository";
import type { Services } from "../service";
import type { AppEmitter } from "../app/emitter";
import { createLogger } from "../lib/logger";

const TICK_INTERVAL_MS = 60_000;
const log = createLogger("scheduler");

async function runSchedule(
  name: string,
  repo: Repository,
  svc: Services,
  emit: AppEmitter,
): Promise<void> {
  const gitlabUrl = repo.settings.getAll().gitlabUrl.trim();
  if (!gitlabUrl) return; // ohne konfigurierte GitLab-URL nichts zu tun

  try {
    if (name === "gitlab_sync") {
      const result = await svc.sync.syncIssues();
      emit.syncCompleted();
      if (result.orphaned > 0) emit.orphanDetected(result.orphaned);
    } else if (name === "orphan_check") {
      const orphaned = await svc.sync.checkOrphans();
      if (orphaned > 0) emit.orphanDetected(orphaned);
    }
    // last_run nur bei Erfolg vorrücken — sonst würde das inkrementelle
    // updated_after-Fenster das fehlgeschlagene Intervall überspringen.
    repo.schedules.updateLastRun(name);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error(`Schedule '${name}' fehlgeschlagen`, { error: message });
    if (name === "gitlab_sync") emit.syncFailed(message);
  }
}

/** Führt alle aktuell fälligen Schedules aus. Exportiert für Tests. */
export async function runDueSchedules(
  repo: Repository,
  svc: Services,
  emit: AppEmitter,
): Promise<void> {
  for (const schedule of repo.schedules.getDue()) {
    await runSchedule(schedule.name, repo, svc, emit);
  }
}

/** Tickt alle 60s und triggert fällige Schedules (gitlab_sync, orphan_check). */
export function startScheduler(repo: Repository, svc: Services, emit: AppEmitter): Timer {
  let isRunning = false;

  async function tick(): Promise<void> {
    if (isRunning) return;
    isRunning = true;
    try {
      await runDueSchedules(repo, svc, emit);
    } finally {
      isRunning = false;
    }
  }

  return setInterval(tick, TICK_INTERVAL_MS);
}
