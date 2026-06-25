import { test, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTodoUiPrefs } from "./useTodoUiPrefs";
import { saveTodoPrefs } from "./todoPrefs";

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

test("Default ohne gespeicherten Stand: view 'today', keine Liste", () => {
  const { result } = renderHook(() => useTodoUiPrefs());
  expect(result.current.view).toBe("today");
  expect(result.current.selectedList).toBeNull();
});

test("Lazy-Init aus localStorage: view + selectedList", () => {
  saveTodoPrefs({
    view: "overdue",
    selectedList: "Privat",
    filter: { tags: [], priorities: [], status: "open" },
    sort: "manual",
  });
  const { result } = renderHook(() => useTodoUiPrefs());
  expect(result.current.view).toBe("overdue");
  expect(result.current.selectedList).toBe("Privat");
});

test("setView / setSelectedList aktualisieren den State", () => {
  const { result } = renderHook(() => useTodoUiPrefs());
  act(() => result.current.setSelectedList("Arbeit"));
  expect(result.current.selectedList).toBe("Arbeit");
  act(() => result.current.setView("all"));
  expect(result.current.view).toBe("all");
});
