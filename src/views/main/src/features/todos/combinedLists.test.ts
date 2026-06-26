import { test, expect } from "vitest";
import type { TodoList, TodoTask } from "../../../../../shared/types";
import { combinedLists } from "./combinedLists";
import { EMPTY_FILTER, type TodoFilter } from "./taskFilterSort";

function task(over: Partial<TodoTask> & Pick<TodoTask, "id" | "listId" | "title">): TodoTask {
  return {
    section: null,
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
    ...over,
  };
}

function list(id: string, tasks: TodoTask[], sections: string[] = []): TodoList {
  return { id, name: id, sections, tasks };
}

const lists: TodoList[] = [
  list("Arbeit", [
    task({ id: "Arbeit#0", listId: "Arbeit", title: "offen" }),
    task({ id: "Arbeit#1", listId: "Arbeit", title: "erledigt", done: true }),
  ]),
  list("Privat", [task({ id: "Privat#0", listId: "Privat", title: "p1" })]),
  list("Leer", [task({ id: "Leer#0", listId: "Leer", title: "auch erledigt", done: true })]),
];

test("Filter 'Offen' (Default) wird pro Liste angewandt", () => {
  const groups = combinedLists(lists, EMPTY_FILTER, "manual");
  const arbeit = groups.find((g) => g.list.id === "Arbeit");
  expect(arbeit?.tasks.map((t) => t.id)).toEqual(["Arbeit#0"]);
});

test("Listen ohne sichtbare Tasks (nach Filter) werden ausgelassen", () => {
  const groups = combinedLists(lists, EMPTY_FILTER, "manual");
  // "Leer" hat nur einen erledigten Task → bei Default-Filter 'Offen' rausgefiltert.
  expect(groups.map((g) => g.list.id)).toEqual(["Arbeit", "Privat"]);
});

test("status:all behält erledigte → Leer-Liste erscheint wieder", () => {
  const all: TodoFilter = { tags: [], priorities: [], status: "all" };
  const groups = combinedLists(lists, all, "manual");
  expect(groups.map((g) => g.list.id)).toEqual(["Arbeit", "Privat", "Leer"]);
});

test("Reihenfolge der Listen = Eingangsreihenfolge", () => {
  const reordered = [lists[1], lists[0]];
  const groups = combinedLists(reordered, EMPTY_FILTER, "manual");
  expect(groups.map((g) => g.list.id)).toEqual(["Privat", "Arbeit"]);
});
