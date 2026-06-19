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

test("migration 013 nulls gitlab_sync.last_run (assignee resync)", () => {
  const db = new Database(":memory:");
  runMigrations(db);

  const applied = db
    .query<{ name: string }, [string]>("SELECT name FROM migrations WHERE name = ?")
    .get("013_resync_assignees.sql");
  expect(applied).not.toBeNull();

  const row = db
    .query<{ last_run: string | null }, []>(
      "SELECT last_run FROM schedules WHERE name = 'gitlab_sync'",
    )
    .get();
  expect(row?.last_run).toBeNull();
});

test("migration 014 adds the ticket metadata columns and nulls gitlab_sync.last_run", () => {
  const db = new Database(":memory:");
  runMigrations(db);

  const cols = db
    .query<{ name: string }, []>("PRAGMA table_info(tickets)")
    .all()
    .map((c) => c.name);
  for (const col of [
    "description",
    "description_html",
    "author_username",
    "author_name",
    "milestone_title",
    "labels_json",
    "due_date",
    "issue_created_at",
  ]) {
    expect(cols).toContain(col);
  }

  // Voll-Resync erzwungen (siehe Migration 014).
  const row = db
    .query<{ last_run: string | null }, []>(
      "SELECT last_run FROM schedules WHERE name = 'gitlab_sync'",
    )
    .get();
  expect(row?.last_run).toBeNull();
});
