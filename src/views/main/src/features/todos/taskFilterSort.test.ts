import { test, expect } from "vitest";
import type { TodoTask } from "../../../../../shared/types";
import {
  EMPTY_FILTER,
  allTagsOf,
  applyFilterSort,
  isFilterActive,
  type TodoFilter,
} from "./taskFilterSort";

function task(overrides: Partial<TodoTask> & Pick<TodoTask, "id">): TodoTask {
  return {
    listId: "L",
    section: null,
    title: overrides.id,
    done: false,
    priority: "normal",
    due: null,
    scheduled: null,
    start: null,
    created: null,
    doneDate: null,
    recurrence: null,
    recurrenceEditableInApp: true,
    tags: [],
    depth: 0,
    description: null,
    ...overrides,
  };
}

function filter(overrides: Partial<TodoFilter>): TodoFilter {
  return { ...EMPTY_FILTER, ...overrides };
}

// EMPTY_FILTER blendet als Default erledigte Tasks aus (status:"open"). Für die
// reinen Sortier-Tests wollen wir ALLE Tasks (inkl. dem erledigten "d") sehen.
const ALL_FILTER: TodoFilter = { tags: [], priorities: [], status: "all" };

const tasks: TodoTask[] = [
  task({ id: "a", priority: "low", due: "2026-06-25", tags: ["x"], title: "Banane" }),
  task({ id: "b", priority: "highest", due: null, tags: ["y"], title: "Apfel" }),
  task({ id: "c", priority: "medium", due: "2026-06-20", tags: ["x", "y"], title: "Citrone" }),
  task({ id: "d", priority: "normal", due: "2026-06-22", tags: [], done: true, title: "Date" }),
];

test("isFilterActive: Default 'Offen' ist NICHT aktiv, Abweichungen sind aktiv", () => {
  // EMPTY_FILTER ist jetzt status:"open" → das ist der Default, also nicht aktiv.
  expect(isFilterActive(EMPTY_FILTER)).toBe(false);
  expect(isFilterActive(filter({ status: "open" }))).toBe(false);
  expect(isFilterActive(filter({ tags: ["x"] }))).toBe(true);
  expect(isFilterActive(filter({ priorities: ["high"] }))).toBe(true);
  // status:"all" weicht vom Default ab → aktiv.
  expect(isFilterActive(filter({ status: "all" }))).toBe(true);
  expect(isFilterActive(filter({ status: "done" }))).toBe(true);
});

test("Filter Tags: Task mit mindestens einem gewählten Tag (ODER)", () => {
  const out = applyFilterSort(tasks, filter({ tags: ["x"] }), "manual");
  expect(out.map((t) => t.id)).toEqual(["a", "c"]);
});

test("Filter Priorities: Priorität in Auswahl", () => {
  const out = applyFilterSort(tasks, filter({ priorities: ["highest", "medium"] }), "manual");
  expect(out.map((t) => t.id)).toEqual(["b", "c"]);
});

test("Filter Status open/done", () => {
  expect(applyFilterSort(tasks, filter({ status: "open" }), "manual").map((t) => t.id)).toEqual([
    "a",
    "b",
    "c",
  ]);
  expect(applyFilterSort(tasks, filter({ status: "done" }), "manual").map((t) => t.id)).toEqual([
    "d",
  ]);
});

test("Kombination über Facetten ist UND-verknüpft", () => {
  const out = applyFilterSort(tasks, filter({ tags: ["y"], status: "open" }), "manual");
  // b (tag y, open) und c (tag y, open); d hat keinen tag, b/c offen.
  expect(out.map((t) => t.id)).toEqual(["b", "c"]);
});

test("Sort manual: Reihenfolge bleibt unverändert (stabil)", () => {
  expect(applyFilterSort(tasks, ALL_FILTER, "manual").map((t) => t.id)).toEqual([
    "a",
    "b",
    "c",
    "d",
  ]);
});

test("Sort priority: highest → lowest", () => {
  expect(applyFilterSort(tasks, ALL_FILTER, "priority").map((t) => t.id)).toEqual([
    "b", // highest
    "c", // medium
    "d", // normal
    "a", // low
  ]);
});

test("Sort due: aufsteigend, null ans Ende", () => {
  expect(applyFilterSort(tasks, ALL_FILTER, "due").map((t) => t.id)).toEqual([
    "c", // 2026-06-20
    "d", // 2026-06-22
    "a", // 2026-06-25
    "b", // null
  ]);
});

test("Sort alpha: nach Titel via localeCompare", () => {
  expect(applyFilterSort(tasks, ALL_FILTER, "alpha").map((t) => t.title)).toEqual([
    "Apfel",
    "Banane",
    "Citrone",
    "Date",
  ]);
});

test("EMPTY_FILTER (Default 'Offen') blendet erledigte Tasks aus", () => {
  // d ist erledigt → fehlt; a/b/c offen bleiben in Datei-Reihenfolge.
  expect(applyFilterSort(tasks, EMPTY_FILTER, "manual").map((t) => t.id)).toEqual(["a", "b", "c"]);
});

test("allTagsOf: dedupliziert und sortiert", () => {
  expect(allTagsOf(tasks)).toEqual(["x", "y"]);
});
