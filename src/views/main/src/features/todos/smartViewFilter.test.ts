import { test, expect } from "vitest";
import type { TodoTask } from "../../../../../shared/types";
import { smartViewFilter, smartViewCounts } from "./smartViewFilter";

const TODAY = "2026-06-22";

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

const tasks: TodoTask[] = [
  task({ id: "today", due: TODAY }),
  task({ id: "overdue", due: "2026-06-19" }),
  task({ id: "upcoming", due: "2026-06-25" }),
  task({ id: "no-due" }),
  task({ id: "done-today", due: TODAY, done: true }),
];

test("Heute: nur offene Tasks mit due === today", () => {
  expect(smartViewFilter(tasks, "today", TODAY).map((t) => t.id)).toEqual(["today"]);
});

test("Überfällig: offene Tasks mit due < today", () => {
  expect(smartViewFilter(tasks, "overdue", TODAY).map((t) => t.id)).toEqual(["overdue"]);
});

test("Anstehend: offene Tasks mit due > today", () => {
  expect(smartViewFilter(tasks, "upcoming", TODAY).map((t) => t.id)).toEqual(["upcoming"]);
});

test("Alle: liefert ALLE Tasks unverändert (auch erledigte, ohne due)", () => {
  expect(smartViewFilter(tasks, "all", TODAY)).toHaveLength(tasks.length);
});

test("erledigte Tasks tauchen in den datierten Smart-Views nicht auf", () => {
  expect(smartViewFilter(tasks, "today", TODAY).some((t) => t.done)).toBe(false);
});

test("smartViewCounts zählt offene pro View, 'all' = alle offenen", () => {
  expect(smartViewCounts(tasks, TODAY)).toEqual({ today: 1, overdue: 1, upcoming: 1, all: 4 });
});
