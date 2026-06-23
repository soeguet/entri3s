import { test, expect } from "bun:test";
import type { Settings, TodoList } from "../../shared/types";
import { startTodoReminders, type TodoRemindersDeps } from "./reminders";

const TODAY = "2026-06-23";

function settings(enabled: boolean): Settings {
  return {
    gitlabUrl: "",
    syncIntervalSec: 300,
    todoFolder: "/vault",
    todoRemindersEnabled: enabled,
  };
}

function dueTodayList(): TodoList[] {
  return [
    {
      id: "l",
      name: "l",
      sections: [],
      tasks: [
        {
          id: "l#1",
          listId: "l",
          section: null,
          title: "t",
          done: false,
          priority: "normal",
          due: TODAY,
          scheduled: null,
          start: null,
          created: null,
          doneDate: null,
          recurrence: null,
          recurrenceEditableInApp: true,
          tags: [],
          depth: 0,
          description: null,
        },
      ],
    },
  ];
}

interface Spy {
  notified: Array<{ title: string; body: string }>;
  lastDate: string;
  deps: TodoRemindersDeps;
}

function makeSpy(over: Partial<TodoRemindersDeps>): Spy {
  const spy: Spy = {
    notified: [],
    lastDate: "",
    deps: {
      getAll: () => settings(true),
      getLists: () => Promise.resolve(dueTodayList()),
      getLastDate: () => spy.lastDate,
      setLastDate: (d) => {
        spy.lastDate = d;
      },
      notify: (title, body) => spy.notified.push({ title, body }),
      today: () => TODAY,
      ...over,
    },
  };
  return spy;
}

// Treibt den Interval-Job einmal an: 1ms Intervall + kurzes Warten.
async function runOnce(deps: TodoRemindersDeps): Promise<void> {
  const handle = startTodoReminders(deps, 1);
  await new Promise((r) => setTimeout(r, 20));
  handle.close();
}

test("notifies and advances lastDate on rollover with due tasks", async () => {
  const spy = makeSpy({});
  await runOnce(spy.deps);
  expect(spy.notified.length).toBeGreaterThanOrEqual(1);
  expect(spy.notified[0].title).toBe("Fällige Aufgaben");
  expect(spy.lastDate).toBe(TODAY);
});

test("does not notify when disabled", async () => {
  const spy = makeSpy({ getAll: () => settings(false) });
  await runOnce(spy.deps);
  expect(spy.notified).toHaveLength(0);
});

test("does not notify when already notified today", async () => {
  const spy = makeSpy({});
  spy.lastDate = TODAY;
  await runOnce(spy.deps);
  expect(spy.notified).toHaveLength(0);
});

test("swallows getLists errors (e.g. TODO_NO_FOLDER)", async () => {
  const spy = makeSpy({
    getLists: () => Promise.reject(new Error("TODO_NO_FOLDER")),
  });
  await runOnce(spy.deps);
  expect(spy.notified).toHaveLength(0);
  expect(spy.lastDate).toBe("");
});
