import { test, expect, beforeEach } from "bun:test";
import type { Database } from "bun:sqlite";
import { createTestDb } from "./test-helper";
import { createRepository, type Repository } from "./index";
import type { TicketUpsert } from "./ticket";

let db: Database;
let repo: Repository;

const PROJECT_ID = 42;

function upsert(iid: number, overrides: Partial<TicketUpsert> = {}): number {
  repo.tickets.upsert({
    gitlabIid: iid,
    gitlabGlobalId: 5000 + iid,
    projectId: PROJECT_ID,
    title: `Issue ${iid}`,
    state: "opened",
    timeEstimate: null,
    timeSpent: null,
    webUrl: null,
    ...overrides,
  });
  return repo.tickets.getByGitLabIid(iid, PROJECT_ID)!.id;
}

/** Erstellt einen Entry der `ticketId` referenziert und setzt sein updated_at fix. */
function entryUsing(ticketId: number, updatedAt: string): void {
  const id = repo.entries.create({
    notes: null,
    durationMinutes: 30,
    date: "2024-01-15T08:00:00.000Z",
    status: "draft",
    tagIds: [],
    ticketIds: [ticketId],
  });
  db.run("UPDATE entries SET updated_at = ? WHERE id = ?", [updatedAt, id]);
}

beforeEach(() => {
  db = createTestDb();
  repo = createRepository(db);
});

test("listRecent orders active tickets by most recent entry usage", () => {
  const a = upsert(1);
  const b = upsert(2);
  entryUsing(a, "2024-01-10T08:00:00.000Z");
  entryUsing(b, "2024-01-20T08:00:00.000Z");

  expect(repo.tickets.listRecent(10).map((t) => t.id)).toEqual([b, a]);
});

test("listRecent excludes orphaned tickets and respects the limit", () => {
  const a = upsert(1);
  const b = upsert(2);
  const c = upsert(3);
  repo.tickets.markOrphaned(3, PROJECT_ID);
  entryUsing(a, "2024-01-10T08:00:00.000Z");
  entryUsing(b, "2024-01-20T08:00:00.000Z");
  entryUsing(c, "2024-01-30T08:00:00.000Z");

  // c ist orphaned → fällt raus; limit 1 → nur das jüngste aktive (b).
  expect(repo.tickets.listRecent(1).map((t) => t.id)).toEqual([b]);
});

test("listRecent dedupes a ticket used by multiple entries", () => {
  const a = upsert(1);
  entryUsing(a, "2024-01-10T08:00:00.000Z");
  entryUsing(a, "2024-01-20T08:00:00.000Z");

  expect(repo.tickets.listRecent(10).map((t) => t.id)).toEqual([a]);
});
