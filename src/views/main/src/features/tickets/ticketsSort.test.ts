import { test, expect } from "vitest";
import type { Ticket } from "../../../../../shared/types";
import { compareTickets, sortTickets } from "./ticketsSort";

function ticket(p: Partial<Ticket>): Ticket {
  return {
    id: p.id ?? 0,
    gitlabIid: p.gitlabIid ?? 0,
    gitlabGlobalId: null,
    projectId: 1,
    title: p.title ?? "",
    state: p.state ?? "opened",
    status: p.status ?? "active",
    timeEstimate: p.timeEstimate ?? null,
    timeSpent: p.timeSpent ?? null,
    webUrl: null,
    assignees: [],
    pinned: p.pinned ?? false,
    unread: false,
    lastViewedAt: null,
    notesCount: 0,
    syncedAt: null,
    createdAt: "",
    updatedAt: "",
  };
}

test("numeric sort by iid asc/desc", () => {
  const a = ticket({ id: 1, gitlabIid: 5 });
  const b = ticket({ id: 2, gitlabIid: 10 });
  expect(compareTickets(a, b, "iid", "asc")).toBeLessThan(0);
  expect(compareTickets(a, b, "iid", "desc")).toBeGreaterThan(0);
});

test("string sort by title via localeCompare", () => {
  const a = ticket({ id: 1, gitlabIid: 1, title: "Apfel" });
  const b = ticket({ id: 2, gitlabIid: 2, title: "Zebra" });
  expect(compareTickets(a, b, "title", "asc")).toBeLessThan(0);
  expect(compareTickets(a, b, "title", "desc")).toBeGreaterThan(0);
});

test("pinned tickets stay first regardless of sort direction", () => {
  const pinned = ticket({ id: 1, gitlabIid: 1, pinned: true });
  const normal = ticket({ id: 2, gitlabIid: 999, pinned: false });
  // Auch wenn iid-asc den normalen zuerst einsortieren würde: pinned bleibt oben.
  expect(compareTickets(pinned, normal, "iid", "asc")).toBeLessThan(0);
  expect(compareTickets(pinned, normal, "iid", "desc")).toBeLessThan(0);
});

test("null estimate values sort stably to the end", () => {
  const withValue = ticket({ id: 1, gitlabIid: 1, timeEstimate: 100 });
  const withNull = ticket({ id: 2, gitlabIid: 2, timeEstimate: null });
  expect(compareTickets(withValue, withNull, "estimate", "asc")).toBeLessThan(0);
  // Richtung dreht das nicht: null bleibt am Ende.
  expect(compareTickets(withValue, withNull, "estimate", "desc")).toBeLessThan(0);
});

test("sortTickets: pinned first, then by sortBy/sortDir, null at end", () => {
  const list = [
    ticket({ id: 1, gitlabIid: 3, timeSpent: 50 }),
    ticket({ id: 2, gitlabIid: 7, timeSpent: null }),
    ticket({ id: 3, gitlabIid: 1, timeSpent: 200, pinned: true }),
    ticket({ id: 4, gitlabIid: 2, timeSpent: 10 }),
  ];
  const sorted = sortTickets(list, "spent", "asc");
  expect(sorted.map((t) => t.id)).toEqual([3, 4, 1, 2]);
});

test("deterministic tiebreak by gitlabIid descending on equal values", () => {
  const a = ticket({ id: 1, gitlabIid: 5, title: "Same" });
  const b = ticket({ id: 2, gitlabIid: 9, title: "Same" });
  // Gleiche Titel → Tiebreak gitlabIid desc → b (9) vor a (5).
  expect(compareTickets(a, b, "title", "asc")).toBeGreaterThan(0);
});
