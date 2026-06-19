import { test, expect, beforeEach } from "bun:test";
import { createTestDb } from "../repository/test-helper";
import { createRepository, type Repository } from "../repository";
import { createBookingService, type BookingPayload } from "./booking";

let repo: Repository;

const PROJECT_ID = 7;

function seedEntry(
  over: { notes?: string | null; date?: string; durationMinutes?: number } = {},
): number {
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
  return repo.entries.create({
    notes: over.notes ?? null,
    durationMinutes: over.durationMinutes ?? 90,
    date: over.date ?? "2024-01-15T22:00:00.000Z",
    status: "draft",
    tagIds: [],
    ticketIds: [ticketId],
  });
}

function enqueuedPayload(): BookingPayload {
  const event = repo.eventQueue.claimNext()!;
  return JSON.parse(event.payload) as BookingPayload;
}

beforeEach(() => {
  repo = createRepository(createTestDb());
});

test("derives spentAt as a plain ISO date from the entry date", () => {
  const entryId = seedEntry({ date: "2024-01-15T22:00:00.000Z" });
  createBookingService(repo).bookEntry(entryId);

  const payload = enqueuedPayload();
  expect(payload.spentAt).toBe("2024-01-15");
  expect(payload.entryId).toBe(entryId);
  expect(payload.ticketIid).toBe(100);
  expect(payload.ticketId).toBeGreaterThan(0);
  expect(payload.issueGlobalId).toBe(9100);
});

test("spentAt uses the Europe/Berlin calendar day, not the UTC day", () => {
  // 23:30Z am 15. ist in Berlin (UTC+1) bereits der 16. um 00:30 → muss auf den 16.
  const entryId = seedEntry({ date: "2024-01-15T23:30:00.000Z" });
  createBookingService(repo).bookEntry(entryId);
  expect(enqueuedPayload().spentAt).toBe("2024-01-16");
});

test("rounds the booked duration up to the next full 15 minutes", () => {
  const entryId = seedEntry({ durationMinutes: 70 }); // 70 → 75
  createBookingService(repo).bookEntry(entryId);
  expect(enqueuedPayload().durationMinutes).toBe(75);
  // Der Entry selbst behält seine echte Dauer.
  expect(repo.entries.getById(entryId)?.durationMinutes).toBe(70);
});

test("note is empty when the entry has no notes", () => {
  const entryId = seedEntry({ notes: null });
  createBookingService(repo).bookEntry(entryId);
  expect(enqueuedPayload().note).toBe("");
});

test("note is the entry notes when present", () => {
  const entryId = seedEntry({ notes: "OAuth-Redirect gefixt" });
  createBookingService(repo).bookEntry(entryId);
  expect(enqueuedPayload().note).toBe("OAuth-Redirect gefixt");
});

test("bookEntry sets the entry to pending_booking", () => {
  const entryId = seedEntry();
  createBookingService(repo).bookEntry(entryId);
  expect(repo.entries.getById(entryId)?.status).toBe("pending_booking");
});

test("bookEntry rejects a ticket without a global GitLab id (needs sync)", () => {
  repo.tickets.upsert({
    gitlabIid: 200,
    gitlabGlobalId: null,
    projectId: PROJECT_ID,
    title: "Ungesynct",
    state: "opened",
    timeEstimate: null,
    timeSpent: null,
    webUrl: null,
    notesCount: 0,
  });
  const ticketId = repo.tickets.getByGitLabIid(200, PROJECT_ID)!.id;
  const entryId = repo.entries.create({
    notes: null,
    durationMinutes: 30,
    date: "2024-01-15T10:00:00.000Z",
    status: "draft",
    tagIds: [],
    ticketIds: [ticketId],
  });
  expect(() => createBookingService(repo).bookEntry(entryId)).toThrow("synchronisiert");
});

test("deleteBooking enqueues a booking_delete event", () => {
  const { entryId, ticketId } = (() => {
    const id = seedEntry();
    return { entryId: id, ticketId: repo.tickets.getByGitLabIid(100, PROJECT_ID)!.id };
  })();
  const bookingId = repo.bookings.create({
    entryId,
    ticketId,
    gitlabTimelogId: 500,
    projectId: PROJECT_ID,
    issueIid: 100,
    durationMinutes: 90,
    note: "",
    spentAt: "2024-01-15",
  });

  createBookingService(repo).deleteBooking(bookingId);

  const event = repo.eventQueue.claimNext()!;
  expect(event.type).toBe("booking_delete");
  expect(JSON.parse(event.payload)).toEqual({ bookingId });
});

test("deleteBooking throws for an unknown booking", () => {
  expect(() => createBookingService(repo).deleteBooking(999)).toThrow("nicht gefunden");
});
