import { test, expect, beforeEach } from "vitest";
import { loadTicketsFilterState, saveTicketsFilterState } from "./ticketsFilterPrefs";
import type { TicketsSearch } from "./ticketsSearch";

// jsdom 29 stellt localStorage unter paralleler Last nicht zuverlässig als Global
// bereit (Worker-Reuse). Darum ein schlankes In-Memory-localStorage garantieren,
// damit der Test deterministisch ist — die Produktiv-Logik bleibt unberührt.
beforeEach(() => {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
});

test("Roundtrip: saveTicketsFilterState → loadTicketsFilterState liefert denselben State", () => {
  const state: TicketsSearch = {
    status: "orphaned",
    state: "opened",
    search: "bug",
    selectedPath: "group/project",
    assignedToMe: true,
    pinnedOnly: false,
    unreadOnly: true,
    sortBy: "title",
    sortDir: "asc",
  };
  saveTicketsFilterState(state);
  expect(loadTicketsFilterState()).toEqual(state);
});

test("loadTicketsFilterState ohne Eintrag → null", () => {
  expect(loadTicketsFilterState()).toBeNull();
});

test("loadTicketsFilterState bei kaputtem JSON → null", () => {
  localStorage.setItem("tickets.filters.state", "{not json");
  expect(loadTicketsFilterState()).toBeNull();
});

test("loadTicketsFilterState bei schema-invalidem Blob → null", () => {
  localStorage.setItem(
    "tickets.filters.state",
    JSON.stringify({ status: "nonsense", sortBy: "whatever" }),
  );
  expect(loadTicketsFilterState()).toBeNull();
});
