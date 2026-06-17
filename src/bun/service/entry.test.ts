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

test("create succeeds without overlap", () => {
  const id = svc.create(input("2024-01-15T10:00:00.000Z", 60));
  expect(id).toBeGreaterThan(0);
});

test("exact same slot overlaps", () => {
  svc.create(input("2024-01-15T10:00:00.000Z", 60));
  expect(() => svc.create(input("2024-01-15T10:00:00.000Z", 60))).toThrow("Überschneidung");
});

test("one-minute overlap is detected", () => {
  svc.create(input("2024-01-15T10:00:00.000Z", 60)); // 10:00–11:00
  expect(() => svc.create(input("2024-01-15T10:59:00.000Z", 60))).toThrow("Überschneidung");
});

test("adjacent slots do not overlap", () => {
  svc.create(input("2024-01-15T10:00:00.000Z", 60)); // 10:00–11:00
  const id = svc.create(input("2024-01-15T11:00:00.000Z", 60)); // 11:00–12:00
  expect(id).toBeGreaterThan(0);
});

test("separate slots do not overlap", () => {
  svc.create(input("2024-01-15T10:00:00.000Z", 60));
  const id = svc.create(input("2024-01-15T14:00:00.000Z", 60));
  expect(id).toBeGreaterThan(0);
});

test("update does not conflict with itself", () => {
  const id = svc.create(input("2024-01-15T10:00:00.000Z", 60));
  const entry = repo.entries.getById(id)!;
  expect(() => svc.update({ ...entry, notes: "Renamed" })).not.toThrow();
});

test("update detects overlap with another entry", () => {
  svc.create(input("2024-01-15T10:00:00.000Z", 60));
  const id = svc.create(input("2024-01-15T14:00:00.000Z", 60));
  const entry = repo.entries.getById(id)!;
  expect(() => svc.update({ ...entry, date: "2024-01-15T10:30:00.000Z" })).toThrow(
    "Überschneidung",
  );
});
