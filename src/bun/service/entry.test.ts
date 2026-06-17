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
