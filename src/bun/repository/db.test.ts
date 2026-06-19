import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "./db";

test("runMigrations creates the full schema", () => {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  runMigrations(db);

  const tables = db
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    )
    .all()
    .map((r) => r.name);

  expect(tables).toContain("entries");
  expect(tables).toContain("tickets");
  expect(tables).toContain("event_queue");
  expect(tables).toContain("schedules");
  expect(tables).toContain("settings");
});

test("runMigrations seeds the default schedules", () => {
  const db = new Database(":memory:");
  runMigrations(db);

  const schedules = db
    .query<{ name: string; interval_sec: number }, []>(
      "SELECT name, interval_sec FROM schedules ORDER BY name",
    )
    .all();

  expect(schedules).toEqual([
    { name: "comment_sync", interval_sec: 900 },
    { name: "gitlab_sync", interval_sec: 300 },
    { name: "orphan_check", interval_sec: 3600 },
  ]);
});

test("runMigrations is idempotent", () => {
  const db = new Database(":memory:");
  runMigrations(db);
  runMigrations(db);

  const count = db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM schedules").get();
  expect(count?.n).toBe(3);
});
