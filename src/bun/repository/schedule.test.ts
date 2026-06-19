import { test, expect, beforeEach } from "bun:test";
import { createTestDb } from "./test-helper";
import { createScheduleRepository } from "./schedule";

let repo: ReturnType<typeof createScheduleRepository>;

beforeEach(() => {
  repo = createScheduleRepository(createTestDb());
});

test("list returns all seeded schedules with their intervals", () => {
  const schedules = repo.list();
  const byName = Object.fromEntries(schedules.map((s) => [s.name, s]));

  expect(schedules).toHaveLength(3);
  expect(byName["gitlab_sync"].intervalSec).toBe(300);
  expect(byName["orphan_check"].intervalSec).toBe(3600);
  expect(byName["comment_sync"].intervalSec).toBe(900);
  // Frisch geseedet → noch nie gelaufen.
  expect(byName["gitlab_sync"].lastRun).toBeNull();
});

test("list reflects a recorded last_run", () => {
  const now = new Date("2026-06-19T10:00:00.000Z");
  repo.updateLastRun("gitlab_sync", now);

  const entry = repo.list().find((s) => s.name === "gitlab_sync")!;
  expect(entry.lastRun).toBe("2026-06-19T10:00:00.000Z");
});
