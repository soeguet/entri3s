import { test, expect } from "bun:test";
import type { Settings, TodoList } from "../../shared/types";
import { startTodoReminders, type TodoRemindersDeps } from "./reminders";

const TODAY = "2026-06-23";

function settings(enabled: boolean, reminderTime = "00:00"): Settings {
  return {
    gitlabUrl: "",
    syncIntervalSec: 300,
    todoFolder: "/vault",
    todoRemindersEnabled: enabled,
    reminderTime,
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
  getListsCalls: number;
  deps: TodoRemindersDeps;
}

function makeSpy(over: Partial<TodoRemindersDeps>): Spy {
  const spy: Spy = {
    notified: [],
    lastDate: "",
    getListsCalls: 0,
    deps: {
      getAll: () => settings(true),
      getLists: () => {
        spy.getListsCalls++;
        return Promise.resolve(dueTodayList());
      },
      getLastDate: () => spy.lastDate,
      setLastDate: (d) => {
        spy.lastDate = d;
      },
      notify: (title, body) => spy.notified.push({ title, body }),
      today: () => TODAY,
      nowTime: () => "12:00",
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

test("time gate: before reminderTime does not notify nor scan the vault", async () => {
  const spy = makeSpy({
    getAll: () => settings(true, "09:00"),
    nowTime: () => "08:59",
  });
  await runOnce(spy.deps);
  expect(spy.notified).toHaveLength(0);
  // Gate greift VOR getLists() -> kein Vault-Scan.
  expect(spy.getListsCalls).toBe(0);
  // Früher Return rückt lastDate nicht vor -> Catch-up ab reminderTime möglich.
  expect(spy.lastDate).toBe("");
});

test("time gate: at or after reminderTime notifies on due tasks", async () => {
  const spy = makeSpy({
    getAll: () => settings(true, "09:00"),
    nowTime: () => "09:30",
  });
  await runOnce(spy.deps);
  expect(spy.notified.length).toBeGreaterThanOrEqual(1);
  expect(spy.lastDate).toBe(TODAY);
});

test("time gate: exactly at reminderTime fires (boundary)", async () => {
  const spy = makeSpy({
    getAll: () => settings(true, "09:00"),
    nowTime: () => "09:00",
  });
  await runOnce(spy.deps);
  expect(spy.notified.length).toBeGreaterThanOrEqual(1);
  expect(spy.lastDate).toBe(TODAY);
});

test("time gate: idempotent via lastDate after firing past reminderTime", async () => {
  const spy = makeSpy({
    getAll: () => settings(true, "09:00"),
    nowTime: () => "09:30",
  });
  spy.lastDate = TODAY;
  await runOnce(spy.deps);
  expect(spy.notified).toHaveLength(0);
  expect(spy.lastDate).toBe(TODAY);
});
