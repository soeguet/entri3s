import { test, expect, beforeEach } from "bun:test";
import { createTestDb } from "../repository/test-helper";
import { createRepository, type Repository } from "../repository";
import { createEntryService } from "./entry";
import type { EntryInput } from "../repository/entry";

let repo: Repository;
let svc: ReturnType<typeof createEntryService>;

beforeEach(() => {
  repo = createRepository(createTestDb());
  svc = createEntryService(repo);
});

function input(date: string, durationMinutes: number): EntryInput {
  return {
    notes: null,
    durationMinutes,
    date,
    status: "draft",
    tagIds: [],
    ticketIds: [],
  };
}

test("create succeeds", () => {
  const id = svc.create(input("2024-01-15T10:00:00.000Z", 60));
  expect(id).toBeGreaterThan(0);
});

test("entries may overlap on the exact same slot", () => {
  svc.create(input("2024-01-15T10:00:00.000Z", 60));
  const id = svc.create(input("2024-01-15T10:00:00.000Z", 60));
  expect(id).toBeGreaterThan(0);
});

test("partially overlapping entries are allowed", () => {
  svc.create(input("2024-01-15T10:00:00.000Z", 60)); // 10:00–11:00
  const id = svc.create(input("2024-01-15T10:30:00.000Z", 60)); // 10:30–11:30
  expect(id).toBeGreaterThan(0);
});

test("update may move an entry onto another entry's slot", () => {
  svc.create(input("2024-01-15T10:00:00.000Z", 60));
  const id = svc.create(input("2024-01-15T14:00:00.000Z", 60));
  const entry = repo.entries.getById(id)!;
  expect(() => svc.update({ ...entry, date: "2024-01-15T10:30:00.000Z" })).not.toThrow();
});

test("update of a missing entry throws NOT_FOUND", () => {
  const entry = {
    id: 999,
    notes: null,
    durationMinutes: 60,
    date: "2024-01-15T10:00:00.000Z",
    status: "draft" as const,
    tagIds: [],
    ticketIds: [],
    createdAt: "2024-01-15T10:00:00.000Z",
    updatedAt: "2024-01-15T10:00:00.000Z",
  };
  expect(() => svc.update(entry)).toThrow("nicht gefunden");
});

test("start creates a running entry that getRunning returns", () => {
  const id = svc.start({ ticketId: null, notes: "Login-Bug" });
  const running = svc.getRunning();
  expect(running?.id).toBe(id);
  expect(running?.status).toBe("running");
  expect(running?.notes).toBe("Login-Bug");
});

test("only one timer may run at a time", () => {
  svc.start({ ticketId: null, notes: null });
  expect(() => svc.start({ ticketId: null, notes: null })).toThrow("läuft bereits");
});

test("stop freezes the duration and turns the entry into a draft", () => {
  const startAt = new Date(Date.now() - 25 * 60_000).toISOString(); // vor 25 Minuten
  const id = svc.start({ ticketId: null, notes: null, startAt });
  svc.stop(id);
  const entry = repo.entries.getById(id)!;
  expect(entry.status).toBe("draft");
  expect(entry.durationMinutes).toBe(25);
  expect(svc.getRunning()).toBeNull();
});

test("a freshly started timer stops with a minimum of one minute", () => {
  const id = svc.start({ ticketId: null, notes: null });
  svc.stop(id);
  expect(repo.entries.getById(id)!.durationMinutes).toBe(1);
});

test("stop of a non-running entry throws", () => {
  const id = svc.create(input("2024-01-15T10:00:00.000Z", 60));
  expect(() => svc.stop(id)).toThrow("läuft nicht");
});

test("resume turns a draft back into a running timer with reset duration", () => {
  const id = svc.create(input("2024-01-15T10:00:00.000Z", 42));
  svc.resume(id);
  const entry = repo.entries.getById(id)!;
  expect(entry.status).toBe("running");
  expect(entry.durationMinutes).toBe(0);
  expect(svc.getRunning()?.id).toBe(id);
});

test("resume of a booking_failed entry removes its dead booking event", () => {
  const id = svc.create(input("2024-01-15T10:00:00.000Z", 30));
  repo.entries.updateStatus(id, "booking_failed");
  // Ein dead-gelaufenes Booking-Event dieses Entries simulieren.
  repo.eventQueue.enqueue("booking", { entryId: id });
  for (let i = 0; i < 3; i++) repo.eventQueue.fail(repo.eventQueue.claimNext()!.id, "boom");
  expect(repo.eventQueue.listDead()).toHaveLength(1);

  svc.resume(id);

  expect(repo.entries.getById(id)!.status).toBe("running");
  expect(repo.entries.getById(id)!.durationMinutes).toBe(0);
  expect(repo.eventQueue.listDead()).toHaveLength(0);
});

test("resume throws ALREADY_RUNNING when a timer is already running", () => {
  svc.start({ ticketId: null, notes: null });
  const id = svc.create(input("2024-01-15T10:00:00.000Z", 30));
  expect(() => svc.resume(id)).toThrow("läuft bereits");
});

test("resume throws INVALID_STATUS for a booked entry", () => {
  const id = svc.create(input("2024-01-15T10:00:00.000Z", 30));
  repo.entries.updateStatus(id, "booked");
  expect(() => svc.resume(id)).toThrow("kann nicht fortgesetzt werden");
});

test("resume of a missing entry throws NOT_FOUND", () => {
  expect(() => svc.resume(999)).toThrow("nicht gefunden");
});

test("setNotes updates only the notes and keeps the entry running", () => {
  const id = svc.start({ ticketId: null, notes: "alt" });
  svc.setNotes(id, "neu");
  const entry = repo.entries.getById(id)!;
  expect(entry.notes).toBe("neu");
  expect(entry.status).toBe("running");
  expect(entry.durationMinutes).toBe(0);
});

test("setNotes on a missing entry throws NOT_FOUND", () => {
  expect(() => svc.setNotes(999, "x")).toThrow("nicht gefunden");
});

test("start carries the preselected tags", () => {
  const t1 = repo.tags.create({ name: "Meeting", color: null });
  const t2 = repo.tags.create({ name: "Review", color: null });
  const id = svc.start({ ticketId: null, notes: null, tagIds: [t1, t2] });
  expect(repo.entries.getById(id)!.tagIds.sort()).toEqual([t1, t2].sort());
});

test("setTags replaces the tag set without touching duration or status", () => {
  const t1 = repo.tags.create({ name: "Meeting", color: null });
  const t2 = repo.tags.create({ name: "Review", color: null });
  const id = svc.start({ ticketId: null, notes: "x", tagIds: [t1] });
  svc.setTags(id, [t2]);
  const entry = repo.entries.getById(id)!;
  expect(entry.tagIds).toEqual([t2]);
  expect(entry.status).toBe("running");
  expect(entry.durationMinutes).toBe(0);
  expect(entry.notes).toBe("x");
});

test("setTags on a missing entry throws NOT_FOUND", () => {
  expect(() => svc.setTags(999, [])).toThrow("nicht gefunden");
});

test("after stopping, a new timer can be started (gapless)", () => {
  const first = svc.start({ ticketId: null, notes: null });
  svc.stop(first);
  const second = svc.start({ ticketId: null, notes: null, startAt: "2024-01-15T11:00:00.000Z" });
  expect(svc.getRunning()?.id).toBe(second);
  expect(svc.getRunning()?.date).toBe("2024-01-15T11:00:00.000Z");
});
