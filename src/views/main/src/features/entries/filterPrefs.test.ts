import { test, expect, beforeEach } from "vitest";
import { loadFilterState, saveFilterState, type PersistedFilterState } from "./filterPrefs";

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

test("Roundtrip: saveFilterState → loadFilterState liefert denselben Blob", () => {
  const blob: PersistedFilterState = {
    status: "booked",
    from: "2026-06-01",
    to: "2026-06-22",
    preset: "today",
    tagIds: [1, 2, 3],
    nodes: ["project:5", "ticket:9"],
  };
  saveFilterState(blob);
  expect(loadFilterState()).toEqual(blob);
});

test("loadFilterState ohne Eintrag → null", () => {
  expect(loadFilterState()).toBeNull();
});

test("loadFilterState bei kaputtem JSON → null", () => {
  localStorage.setItem("entries.filters.state", "{not json");
  expect(loadFilterState()).toBeNull();
});

test("loadFilterState bei strukturell kaputtem Blob (tagIds kein Array) → null", () => {
  localStorage.setItem(
    "entries.filters.state",
    JSON.stringify({ status: "", from: "", to: "", preset: null, tagIds: "nope", nodes: [] }),
  );
  expect(loadFilterState()).toBeNull();
});
