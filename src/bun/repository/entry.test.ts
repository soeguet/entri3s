import { test, expect, beforeEach } from "bun:test";
import { createTestDb } from "./test-helper";
import { createEntryRepository, type EntryInput } from "./entry";

let repo: ReturnType<typeof createEntryRepository>;

beforeEach(() => {
  repo = createEntryRepository(createTestDb());
});

function input(overrides: Partial<EntryInput> = {}): EntryInput {
  return {
    title: "Test",
    notes: null,
    durationMinutes: 60,
    date: "2024-01-15T10:00:00.000Z",
    status: "draft",
    tagIds: [],
    ticketIds: [],
    ...overrides,
  };
}

test("create returns a new id", () => {
  const id = repo.create(input());
  expect(id).toBeGreaterThan(0);
});

test("getById returns the created entry", () => {
  const id = repo.create(input({ title: "Meeting" }));
  const entry = repo.getById(id);
  expect(entry?.title).toBe("Meeting");
  expect(entry?.durationMinutes).toBe(60);
  expect(entry?.status).toBe("draft");
});

test("getById returns null when not found", () => {
  expect(repo.getById(999)).toBeNull();
});

test("list filters by status", () => {
  repo.create(input({ status: "draft" }));
  repo.create(input({ date: "2024-01-16T10:00:00.000Z", status: "booked" }));
  expect(repo.list({ status: "booked" })).toHaveLength(1);
  expect(repo.list()).toHaveLength(2);
});

test("list filters by date range", () => {
  repo.create(input({ date: "2024-01-10T10:00:00.000Z" }));
  repo.create(input({ date: "2024-01-20T10:00:00.000Z" }));
  const result = repo.list({ dateFrom: "2024-01-15T00:00:00.000Z" });
  expect(result).toHaveLength(1);
  expect(result[0].date).toBe("2024-01-20T10:00:00.000Z");
});

test("update persists changes", () => {
  const id = repo.create(input());
  const entry = repo.getById(id)!;
  repo.update({ ...entry, title: "Updated", durationMinutes: 30 });
  const after = repo.getById(id);
  expect(after?.title).toBe("Updated");
  expect(after?.durationMinutes).toBe(30);
});

test("updateStatus changes only the status", () => {
  const id = repo.create(input());
  repo.updateStatus(id, "booked");
  expect(repo.getById(id)?.status).toBe("booked");
});

test("delete removes the entry", () => {
  const id = repo.create(input());
  repo.delete(id);
  expect(repo.getById(id)).toBeNull();
});
