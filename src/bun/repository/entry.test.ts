import { test, expect, beforeEach } from "bun:test";
import { createTestDb } from "./test-helper";
import { createEntryRepository, type EntryInput } from "./entry";
import { createRepository, type Repository } from "./index";

let repo: ReturnType<typeof createEntryRepository>;
let full: Repository;

beforeEach(() => {
  full = createRepository(createTestDb());
  repo = full.entries;
});

/** Legt ein Ticket an und gibt dessen DB-id zurück. */
function ticket(iid: number, projectId: number): number {
  full.tickets.upsert({
    gitlabIid: iid,
    gitlabGlobalId: 5000 + iid,
    projectId,
    title: `Issue ${iid}`,
    state: "opened",
    timeEstimate: null,
    timeSpent: null,
    webUrl: null,
  });
  return full.tickets.getByGitLabIid(iid, projectId)!.id;
}

function input(overrides: Partial<EntryInput> = {}): EntryInput {
  return {
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
  const id = repo.create(input({ notes: "Meeting" }));
  const entry = repo.getById(id);
  expect(entry?.notes).toBe("Meeting");
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
  repo.update({ ...entry, notes: "Updated", durationMinutes: 30 });
  const after = repo.getById(id);
  expect(after?.notes).toBe("Updated");
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

test("list filters by ticketId", () => {
  const t1 = ticket(1, 100);
  const t2 = ticket(2, 100);
  const wanted = repo.create(input({ ticketIds: [t1] }));
  repo.create(input({ ticketIds: [t2] }));

  const result = repo.list({ ticketIds: [t1] });
  expect(result.map((e) => e.id)).toEqual([wanted]);
});

test("list filters by projectId without duplicates across multiple tickets", () => {
  const t1 = ticket(1, 100);
  const t2 = ticket(2, 100); // gleiches Projekt
  const tOther = ticket(3, 200);
  // Entry referenziert ZWEI Tickets desselben Projekts → darf nur einmal erscheinen.
  const wanted = repo.create(input({ ticketIds: [t1, t2] }));
  repo.create(input({ ticketIds: [tOther] }));

  const result = repo.list({ projectIds: [100] });
  expect(result.map((e) => e.id)).toEqual([wanted]);
});

test("list combines projectIds and ticketIds with OR", () => {
  const t1 = ticket(1, 100);
  const t2 = ticket(2, 200);
  const t3 = ticket(3, 300);
  const byProject = repo.create(input({ ticketIds: [t1] })); // matcht projectId 100
  const byTicket = repo.create(input({ ticketIds: [t2] })); // matcht ticketId t2
  repo.create(input({ ticketIds: [t3] })); // matcht nichts

  const result = repo.list({ projectIds: [100], ticketIds: [t2] });
  expect(result.map((e) => e.id).sort()).toEqual([byProject, byTicket].sort());
});

test("list combines hierarchy filter with status (AND)", () => {
  const t1 = ticket(1, 100);
  repo.create(input({ ticketIds: [t1], status: "draft" }));
  const wanted = repo.create(
    input({ date: "2024-01-16T10:00:00.000Z", ticketIds: [t1], status: "booked" }),
  );

  const result = repo.list({ projectIds: [100], status: "booked" });
  expect(result.map((e) => e.id)).toEqual([wanted]);
});

test("list treats empty hierarchy arrays as no filter", () => {
  const t1 = ticket(1, 100);
  repo.create(input({ ticketIds: [t1] }));
  repo.create(input());

  expect(repo.list({ projectIds: [], ticketIds: [] })).toHaveLength(2);
});
