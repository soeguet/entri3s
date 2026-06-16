import type { Repository } from "../repository";
import type { Services } from "../service";
import type { AppEmitter } from "../app/emitter";

const TICK_INTERVAL_MS = 60_000;

async function runSchedule(
  name: string,
  repo: Repository,
  svc: Services,
  emit: AppEmitter,
): Promise<void> {
  const projectId = repo.settings.getAll().projectId;
  if (!projectId) return; // ohne konfiguriertes Projekt nichts zu tun

  try {
    if (name === "gitlab_sync") {
      const result = await svc.sync.syncIssues(projectId);
      emit.syncCompleted();
      if (result.orphaned > 0) emit.orphanDetected(result.orphaned);
    } else if (name === "orphan_check") {
      const orphaned = await svc.sync.checkOrphans(projectId);
      if (orphaned > 0) emit.orphanDetected(orphaned);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (name === "gitlab_sync") emit.syncFailed(message);
  } finally {
    repo.schedules.updateLastRun(name);
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
