import { test, expect } from "bun:test";
import type { TodoTask } from "../../shared/types";
import { buildReminder } from "./reminder";

function task(partial: Partial<TodoTask>): TodoTask {
  return {
    id: "l#1",
    listId: "l",
    section: null,
    title: "t",
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
    ...partial,
  };
}

const TODAY = "2026-06-23";

test("rollover: notifies when lastDate < today and there are due tasks", () => {
  const r = buildReminder([task({ due: TODAY })], TODAY, "2026-06-22");
  expect(r).not.toBeNull();
  expect(r!.lastDate).toBe(TODAY);
});

test("same day: returns null when already notified today", () => {
  const r = buildReminder([task({ due: TODAY })], TODAY, TODAY);
  expect(r).toBeNull();
});

test("no due/overdue tasks: returns null (does not advance lastDate)", () => {
  const r = buildReminder([task({ due: "2026-06-30" })], TODAY, "2026-06-22");
  expect(r).toBeNull();
});

test("done tasks are ignored", () => {
  const r = buildReminder([task({ due: TODAY, done: true })], TODAY, "");
  expect(r).toBeNull();
});

test("body: only overdue", () => {
  const r = buildReminder([task({ due: "2026-06-20" })], TODAY, "");
  expect(r!.body).toBe("1 überfällig");
});

test("body: only due today", () => {
  const r = buildReminder([task({ due: TODAY }), task({ due: TODAY })], TODAY, "");
  expect(r!.body).toBe("2 heute fällig");
});

test("body: both due today and overdue", () => {
  const tasks = [
    task({ due: TODAY }),
    task({ due: TODAY }),
    task({ due: TODAY }),
    task({ due: "2026-06-19" }),
    task({ due: "2026-06-20" }),
  ];
  const r = buildReminder(tasks, TODAY, "");
  expect(r!.body).toBe("3 heute fällig · 2 überfällig");
  expect(r!.title).toBe("Fällige Aufgaben");
});
