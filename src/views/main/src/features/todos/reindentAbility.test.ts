import { test, expect } from "vitest";
import type { TodoTask } from "../../../../../shared/types";
import { reindentAbility } from "./reindentAbility";

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

test("erster Top-Level-Task: weder Indent noch Outdent", () => {
  const ability = reindentAbility([task("a", 0)]);
  expect(ability.get("a")).toEqual({ canIndent: false, canOutdent: false });
});

test("Task nach gleich-tiefem Vorgänger: canIndent true", () => {
  const ability = reindentAbility([task("a", 0), task("b", 0)]);
  expect(ability.get("b")?.canIndent).toBe(true);
  expect(ability.get("b")?.canOutdent).toBe(false);
});

test("Subtask: canOutdent true", () => {
  const ability = reindentAbility([task("a", 0), task("b", 1)]);
  expect(ability.get("b")?.canOutdent).toBe(true);
});

test("Task nach flacherem Vorgänger (erste Subtask-Position): canIndent false", () => {
  // a(0) → b(1): b ist erster Subtask von a. Ein weiteres Einrücken von b ist
  // nicht möglich, weil der Vorgänger a flacher ist als b.
  const ability = reindentAbility([task("a", 0), task("b", 1)]);
  expect(ability.get("b")?.canIndent).toBe(false);
});
