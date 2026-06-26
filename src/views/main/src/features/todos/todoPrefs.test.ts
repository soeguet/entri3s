import { test, expect, beforeEach } from "vitest";
import { loadTodoPrefs, saveTodoPrefs, type PersistedTodoUi } from "./todoPrefs";

// jsdom 29 stellt localStorage unter paralleler Last nicht zuverlässig als Global
// bereit (Worker-Reuse) — schlankes In-Memory-localStorage garantieren.
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

const valid: PersistedTodoUi = {
  view: "upcoming",
  selectedList: "Arbeit",
  combined: false,
  filter: { tags: ["x"], priorities: ["high"], status: "done" },
  sort: "priority",
};

test("load gibt null ohne gespeicherten Wert", () => {
  expect(loadTodoPrefs()).toBeNull();
});

test("round-trip save -> load", () => {
  saveTodoPrefs(valid);
  expect(loadTodoPrefs()).toEqual(valid);
});

test("load: kaputter JSON → null", () => {
  localStorage.setItem("todos.ui.state", "{ not json");
  expect(loadTodoPrefs()).toBeNull();
});

test("load: ungültige view fällt auf 'today' zurück", () => {
  localStorage.setItem("todos.ui.state", JSON.stringify({ ...valid, view: "bogus" }));
  expect(loadTodoPrefs()?.view).toBe("today");
});

test("load: ungültiger sort fällt auf 'manual' zurück", () => {
  localStorage.setItem("todos.ui.state", JSON.stringify({ ...valid, sort: "wat" }));
  expect(loadTodoPrefs()?.sort).toBe("manual");
});

test("load: ungültiger filter.status fällt auf Default 'open' zurück", () => {
  localStorage.setItem(
    "todos.ui.state",
    JSON.stringify({ ...valid, filter: { tags: [], priorities: [], status: "weird" } }),
  );
  expect(loadTodoPrefs()?.filter.status).toBe("open");
});

test("load: nicht-string selectedList → null", () => {
  localStorage.setItem("todos.ui.state", JSON.stringify({ ...valid, selectedList: 42 }));
  expect(loadTodoPrefs()?.selectedList).toBeNull();
});

test("load: fehlender/kaputter filter → Default-Filter", () => {
  localStorage.setItem("todos.ui.state", JSON.stringify({ ...valid, filter: null }));
  expect(loadTodoPrefs()?.filter).toEqual({ tags: [], priorities: [], status: "open" });
});

test("round-trip save -> load mit combined:true", () => {
  saveTodoPrefs({ ...valid, combined: true });
  expect(loadTodoPrefs()?.combined).toBe(true);
});

test("load: fehlendes combined → default false", () => {
  const { combined, ...rest } = valid;
  void combined;
  localStorage.setItem("todos.ui.state", JSON.stringify(rest));
  expect(loadTodoPrefs()?.combined).toBe(false);
});

test("load: nicht-boolean combined → false", () => {
  localStorage.setItem("todos.ui.state", JSON.stringify({ ...valid, combined: "yes" }));
  expect(loadTodoPrefs()?.combined).toBe(false);
});
