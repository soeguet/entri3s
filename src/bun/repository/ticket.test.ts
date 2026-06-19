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
    notesCount: 0,
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

test("setAssignees replaces the existing assignees of a ticket", () => {
  const id = upsert(1);
  repo.tickets.setAssignees(id, [
    { gitlabUserId: 7, username: "alice", name: "Alice" },
    { gitlabUserId: 8, username: "bob", name: "Bob" },
  ]);
  expect(repo.tickets.getById(id)?.assignees).toHaveLength(2);

  // Replace: alte Assignees verschwinden, nur die neue Liste bleibt.
  repo.tickets.setAssignees(id, [{ gitlabUserId: 9, username: "carol", name: "Carol" }]);
  expect(repo.tickets.getById(id)?.assignees).toEqual([
    { gitlabUserId: 9, username: "carol", name: "Carol" },
  ]);
});

test("list and getById populate assignees", () => {
  const id = upsert(1);
  repo.tickets.setAssignees(id, [{ gitlabUserId: 7, username: "alice", name: "Alice" }]);

  expect(repo.tickets.getById(id)?.assignees).toEqual([
    { gitlabUserId: 7, username: "alice", name: "Alice" },
  ]);
  expect(repo.tickets.list().find((t) => t.id === id)?.assignees).toEqual([
    { gitlabUserId: 7, username: "alice", name: "Alice" },
  ]);
});

test("list with assignedToMe filters to tickets assigned to the given user", () => {
  const mine = upsert(1);
  const other = upsert(2);
  upsert(3); // ohne Assignee
  repo.tickets.setAssignees(mine, [{ gitlabUserId: 42, username: "me", name: "Me" }]);
  repo.tickets.setAssignees(other, [{ gitlabUserId: 99, username: "you", name: "You" }]);

  const result = repo.tickets.list({ assignedToMe: true }, 42);
  expect(result.map((t) => t.id)).toEqual([mine]);
});

test("list ignores assignedToMe when no currentUserId is given", () => {
  const mine = upsert(1);
  repo.tickets.setAssignees(mine, [{ gitlabUserId: 42, username: "me", name: "Me" }]);
  upsert(2);

  // Ohne userId greift der Filter nicht → alle Tickets.
  expect(repo.tickets.list({ assignedToMe: true })).toHaveLength(2);
});

test("pin and unpin toggle the pinned flag (idempotent)", () => {
  const id = upsert(1);
  expect(repo.tickets.getById(id)?.pinned).toBe(false);

  repo.tickets.pin(id);
  expect(repo.tickets.getById(id)?.pinned).toBe(true);

  // pin ist idempotent — zweiter Aufruf wirft nicht und bleibt gepinnt.
  expect(() => repo.tickets.pin(id)).not.toThrow();
  expect(repo.tickets.getById(id)?.pinned).toBe(true);

  repo.tickets.unpin(id);
  expect(repo.tickets.getById(id)?.pinned).toBe(false);
});

test("listPinned returns only pinned active tickets, newest pin first", () => {
  const a = upsert(1);
  const b = upsert(2);
  repo.tickets.pin(a);
  repo.tickets.pin(b);
  // pinned_at hat 1s-Auflösung (CURRENT_TIMESTAMP) → für deterministische
  // Reihenfolge das pinned_at direkt setzen.
  db.run("UPDATE ticket_pins SET pinned_at = ? WHERE ticket_id = ?", ["2024-01-10 08:00:00", a]);
  db.run("UPDATE ticket_pins SET pinned_at = ? WHERE ticket_id = ?", ["2024-01-20 08:00:00", b]);

  // b wurde später gepinnt → zuerst.
  expect(repo.tickets.listPinned().map((t) => t.id)).toEqual([b, a]);

  // Orphaned Tickets sind ausgeschlossen, auch wenn gepinnt.
  const c = upsert(3);
  repo.tickets.setStatus(c, "orphaned");
  repo.tickets.pin(c);
  expect(repo.tickets.listPinned().map((t) => t.id)).not.toContain(c);
});

test("list with pinned filter returns only pinned tickets", () => {
  const a = upsert(1);
  upsert(2);
  repo.tickets.pin(a);

  expect(repo.tickets.list({ pinned: true }).map((t) => t.id)).toEqual([a]);
});
