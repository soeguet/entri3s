import { test, expect, beforeEach } from "bun:test";
import type { Database } from "bun:sqlite";
import type { BookingInsert } from "../../shared/types";
import { createTestDb } from "./test-helper";
import { createRepository, type Repository } from ".";

let repo: Repository;
let db: Database;

const PROJECT_ID = 7;

function seedEntryAndTicket(): { entryId: number; ticketId: number } {
  repo.tickets.upsert({
    gitlabIid: 100,
    gitlabGlobalId: 9100,
    projectId: PROJECT_ID,
    title: "Ticket",
    state: "opened",
    timeEstimate: null,
    timeSpent: null,
    webUrl: null,
    notesCount: 0,
  });
  const ticketId = repo.tickets.getByGitLabIid(100, PROJECT_ID)!.id;
  const entryId = repo.entries.create({
    notes: null,
    durationMinutes: 90,
    date: "2024-01-15T10:00:00.000Z",
    status: "draft",
    tagIds: [],
    ticketIds: [ticketId],
  });
  return { entryId, ticketId };
}

function makeInsert(over: Partial<BookingInsert> = {}): BookingInsert {
  const { entryId, ticketId } = seedEntryAndTicket();
  return {
    entryId,
    ticketId,
    gitlabTimelogId: 500,
    projectId: PROJECT_ID,
    issueIid: 100,
    durationMinutes: 90,
    note: "Work",
    spentAt: "2024-01-15",
    ...over,
  };
}

beforeEach(() => {
  db = createTestDb();
  repo = createRepository(db);
});

test("create persists a booking and returns its id", () => {
  const insert = makeInsert();
  const id = repo.bookings.create(insert);
  expect(id).toBeGreaterThan(0);

  const stored = repo.bookings.listByEntry(insert.entryId);
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({
    id,
    entryId: insert.entryId,
    gitlabTimelogId: 500,
    note: "Work",
    spentAt: "2024-01-15",
  });
  expect(stored[0].bookedAt).toBeTruthy();
});

test("listByEntry returns only the given entry's bookings", () => {
  const insert = makeInsert();
  repo.bookings.create(insert);
  const other = makeInsert({ gitlabTimelogId: 501 });
  repo.bookings.create(other);

  expect(repo.bookings.listByEntry(insert.entryId)).toHaveLength(1);
  expect(repo.bookings.listByEntry(other.entryId)).toHaveLength(1);
});

test("listByDateRange filters on spent_at", () => {
  repo.bookings.create(makeInsert({ spentAt: "2024-01-15" }));
  repo.bookings.create(makeInsert({ gitlabTimelogId: 501, spentAt: "2024-02-20" }));

  const jan = repo.bookings.listByDateRange("2024-01-01", "2024-01-31");
  expect(jan).toHaveLength(1);
  expect(jan[0].spentAt).toBe("2024-01-15");
});

test("getByTimelogId finds a booking for the duplicate check", () => {
  repo.bookings.create(makeInsert({ gitlabTimelogId: 999 }));
  expect(repo.bookings.getByTimelogId(999, PROJECT_ID)?.gitlabTimelogId).toBe(999);
  expect(repo.bookings.getByTimelogId(123, PROJECT_ID)).toBeNull();
});

test("getById and delete round-trip", () => {
  const id = repo.bookings.create(makeInsert({ gitlabTimelogId: 321 }));
  expect(repo.bookings.getById(id)?.gitlabTimelogId).toBe(321);

  repo.bookings.delete(id);
  expect(repo.bookings.getById(id)).toBeNull();
});

test("UNIQUE(gitlab_timelog_id, project_id) rejects duplicates", () => {
  repo.bookings.create(makeInsert({ gitlabTimelogId: 42 }));
  expect(() => repo.bookings.create(makeInsert({ gitlabTimelogId: 42 }))).toThrow();
});
