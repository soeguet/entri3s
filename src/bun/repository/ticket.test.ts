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
    description: null,
    descriptionHtml: null,
    authorUsername: null,
    authorName: null,
    milestoneTitle: null,
    labels: [],
    dueDate: null,
    issueCreatedAt: null,
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

test("upsert stores and toTicket reads back the new metadata incl. labels JSON", () => {
  const id = upsert(1, {
    description: "Body **md**",
    descriptionHtml: "<p>Body</p>",
    authorUsername: "alice",
    authorName: "Alice",
    milestoneTitle: "Sprint 1",
    labels: [
      { title: "bug", color: "#ff0000" },
      { title: "ui", color: "#00ff00" },
    ],
    dueDate: "2024-02-01",
    issueCreatedAt: "2024-01-01T08:00:00.000Z",
  });

  const t = repo.tickets.getById(id)!;
  expect(t.description).toBe("Body **md**");
  expect(t.descriptionHtml).toBe("<p>Body</p>");
  expect(t.author).toEqual({ username: "alice", name: "Alice" });
  expect(t.milestoneTitle).toBe("Sprint 1");
  expect(t.labels).toEqual([
    { title: "bug", color: "#ff0000" },
    { title: "ui", color: "#00ff00" },
  ]);
  expect(t.dueDate).toBe("2024-02-01");
  expect(t.issueCreatedAt).toBe("2024-01-01T08:00:00.000Z");
});

test("toTicket yields null author and empty labels when metadata is absent", () => {
  const id = upsert(1);
  const t = repo.tickets.getById(id)!;
  expect(t.description).toBeNull();
  expect(t.author).toBeNull();
  expect(t.labels).toEqual([]);
  expect(t.milestoneTitle).toBeNull();
  expect(t.issueCreatedAt).toBeNull();
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

test("a new ticket without read-state is unread", () => {
  const id = upsert(1, { notesCount: 2 });
  expect(repo.tickets.getById(id)?.unread).toBe(true);
});

test("markRead clears the unread flag", () => {
  const id = upsert(1, { notesCount: 2 });
  repo.tickets.markRead(id);
  expect(repo.tickets.getById(id)?.unread).toBe(false);
});

test("a ticket becomes unread again when notesCount grows past the read count", () => {
  const id = upsert(1, { notesCount: 2 });
  repo.tickets.markRead(id);
  expect(repo.tickets.getById(id)?.unread).toBe(false);

  // Gleiche iid → gleiche id (ON CONFLICT(gitlab_iid, project_id)), nun mehr Kommentare.
  upsert(1, { notesCount: 5 });
  expect(repo.tickets.getById(id)?.unread).toBe(true);
});

test("markAllRead marks all active tickets as read", () => {
  const a = upsert(1, { notesCount: 2 });
  const b = upsert(2, { notesCount: 3 });

  repo.tickets.markAllRead();
  expect(repo.tickets.getById(a)?.unread).toBe(false);
  expect(repo.tickets.getById(b)?.unread).toBe(false);
});

test("markAllRead with a state filter only marks matching tickets, others stay unread", () => {
  const opened = upsert(1, { notesCount: 2, state: "opened" });
  const closed = upsert(2, { notesCount: 3, state: "closed" });

  repo.tickets.markAllRead({ state: "opened" });

  // Nur das zum Filter passende Ticket wird gelesen; das andere bleibt unread.
  expect(repo.tickets.getById(opened)?.unread).toBe(false);
  expect(repo.tickets.getById(closed)?.unread).toBe(true);
});

test("markAllRead with assignedToMe only marks the user's tickets, others stay unread", () => {
  const mine = upsert(1, { notesCount: 2 });
  const other = upsert(2, { notesCount: 3 });
  repo.tickets.setAssignees(mine, [{ gitlabUserId: 42, username: "me", name: "Me" }]);
  repo.tickets.setAssignees(other, [{ gitlabUserId: 99, username: "you", name: "You" }]);

  repo.tickets.markAllRead({ assignedToMe: true }, 42);

  expect(repo.tickets.getById(mine)?.unread).toBe(false);
  expect(repo.tickets.getById(other)?.unread).toBe(true);
});

test("countUnread counts a ticket without read-state as unread", () => {
  upsert(1, { notesCount: 2 });
  expect(repo.tickets.countUnread()).toBe(1);
});

test("countUnread counts a ticket whose notesCount grew past the read count", () => {
  const id = upsert(1, { notesCount: 2 });
  repo.tickets.markRead(id);
  expect(repo.tickets.countUnread()).toBe(0);

  upsert(1, { notesCount: 5 });
  expect(repo.tickets.countUnread()).toBe(1);
});

test("countUnread does not count read tickets", () => {
  const a = upsert(1, { notesCount: 2 });
  upsert(2, { notesCount: 3 });
  repo.tickets.markRead(a);

  // a gelesen, b ungelesen → genau 1.
  expect(repo.tickets.countUnread()).toBe(1);
});

test("countUnread ignores non-active (orphaned) tickets", () => {
  upsert(1, { notesCount: 2 });
  const orphan = upsert(2, { notesCount: 3 });
  repo.tickets.setStatus(orphan, "orphaned");

  // Orphaned bleibt ungezählt, obwohl ohne read-state.
  expect(repo.tickets.countUnread()).toBe(1);
});

test("list with unread filter returns only unread tickets", () => {
  const read = upsert(1, { notesCount: 2 });
  const unread = upsert(2, { notesCount: 3 });
  repo.tickets.markRead(read);

  expect(repo.tickets.list({ unread: true }).map((t) => t.id)).toEqual([unread]);
});

test("getById liefert lastViewedAt erst nach markRead", () => {
  const id = upsert(1, { notesCount: 2 });
  expect(repo.tickets.getById(id)?.lastViewedAt).toBeNull();
  repo.tickets.markRead(id);
  expect(repo.tickets.getById(id)?.lastViewedAt).not.toBeNull();
});
