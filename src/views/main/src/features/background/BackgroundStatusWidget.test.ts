import { test, expect } from "vitest";
import type { BackgroundStatus } from "../../../../../shared/types";
import { syncLabel } from "./BackgroundStatusWidget";

const NOW = Date.parse("2026-06-19T12:00:00.000Z");

function status(overrides: Partial<BackgroundStatus> = {}): BackgroundStatus {
  return {
    syncRunning: false,
    schedules: [
      {
        name: "gitlab_sync",
        intervalSec: 300,
        lastRunAt: "2026-06-19T11:57:00.000Z",
        nextRunAt: "2026-06-19T12:02:00.000Z",
      },
    ],
    queue: { pending: 0, processing: 0, dead: 0 },
    ...overrides,
  };
}

test("syncRunning zeigt 'Sync läuft…'", () => {
  expect(syncLabel(status({ syncRunning: true }), NOW)).toBe("Sync läuft…");
});

test("berechnet relative Restzeit bis zum nächsten Sync", () => {
  // nextRunAt liegt 2 min in der Zukunft.
  expect(syncLabel(status(), NOW)).toBe("Sync in ~2 min");
});

test("nextRunAt in der Vergangenheit ist 'Sync fällig'", () => {
  const past = status({
    schedules: [
      {
        name: "gitlab_sync",
        intervalSec: 300,
        lastRunAt: "2026-06-19T11:50:00.000Z",
        nextRunAt: "2026-06-19T11:55:00.000Z",
      },
    ],
  });
  expect(syncLabel(past, NOW)).toBe("Sync fällig");
});

test("ohne gitlab_sync-Schedule ist 'Sync fällig'", () => {
  expect(syncLabel(status({ schedules: [] }), NOW)).toBe("Sync fällig");
});
