import { test, expect, beforeEach } from "bun:test";
import { createTestDb } from "../repository/test-helper";
import { createRepository, type Repository } from "../repository";
import { createBackgroundService } from "./background";
import type { SyncService } from "./sync";

let repo: Repository;

beforeEach(() => {
  repo = createRepository(createTestDb());
});

/** Minimaler Sync-Stub: nur isSyncing wird vom Background-Service gelesen. */
function fakeSync(syncing: boolean): SyncService {
  return { isSyncing: () => syncing } as unknown as SyncService;
}

test("getStatus passes syncRunning through from the sync service", () => {
  expect(createBackgroundService(repo, fakeSync(true)).getStatus().syncRunning).toBe(true);
  expect(createBackgroundService(repo, fakeSync(false)).getStatus().syncRunning).toBe(false);
});

test("getStatus reports nextRunAt = null while a schedule has never run", () => {
  const svc = createBackgroundService(repo, fakeSync(false));
  const sync = svc.getStatus().schedules.find((s) => s.name === "gitlab_sync")!;

  expect(sync.lastRunAt).toBeNull();
  expect(sync.nextRunAt).toBeNull();
});

test("getStatus computes nextRunAt as lastRun + intervalSec", () => {
  // gitlab_sync läuft alle 300s → nextRunAt = lastRun + 300s.
  repo.schedules.updateLastRun("gitlab_sync", new Date("2026-06-19T10:00:00.000Z"));

  const svc = createBackgroundService(repo, fakeSync(false));
  const sync = svc.getStatus().schedules.find((s) => s.name === "gitlab_sync")!;

  expect(sync.lastRunAt).toBe("2026-06-19T10:00:00.000Z");
  expect(sync.nextRunAt).toBe("2026-06-19T10:05:00.000Z");
});

test("getStatus reports all three seeded schedules", () => {
  const svc = createBackgroundService(repo, fakeSync(false));
  const names = svc
    .getStatus()
    .schedules.map((s) => s.name)
    .sort();
  expect(names).toEqual(["comment_sync", "gitlab_sync", "orphan_check"]);
});

test("getStatus aggregates the event-queue counts", () => {
  repo.eventQueue.enqueue("a", {});
  repo.eventQueue.enqueue("b", {});
  repo.eventQueue.claimNext(); // a → processing

  const queue = createBackgroundService(repo, fakeSync(false)).getStatus().queue;
  expect(queue).toEqual({ pending: 1, processing: 1, dead: 0 });
});
