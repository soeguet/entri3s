import { describe, it, expect } from "vitest";
import type { TodoTask } from "../../../../../shared/types";
import { subtasksOf } from "./subtaskTree";

function task(id: string, depth: number): TodoTask {
  return {
    id,
    listId: "L",
    section: null,
    title: id,
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
    depth,
    description: null,
  };
}

describe("subtasksOf", () => {
  // a(0) > b(1) > c(2), d(1), dann e(0)
  const ordered = [task("a", 0), task("b", 1), task("c", 2), task("d", 1), task("e", 0)];

  it("sammelt den gesamten Subtree bis zum nächsten Task gleicher/geringerer Tiefe", () => {
    expect(subtasksOf(ordered, ordered[0]).map((t) => t.id)).toEqual(["b", "c", "d"]);
  });

  it("verschachtelter Subtree: b liefert nur c", () => {
    expect(subtasksOf(ordered, ordered[1]).map((t) => t.id)).toEqual(["c"]);
  });

  it("Task ohne Subtasks liefert leeres Array", () => {
    expect(subtasksOf(ordered, ordered[4])).toEqual([]);
  });

  it("unbekannter Task liefert leeres Array", () => {
    expect(subtasksOf(ordered, task("x", 0))).toEqual([]);
  });
});
