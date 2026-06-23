import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TodoList, TodoTask } from "../../../../../shared/types";
import { TodoSearchDialog } from "./TodoSearchDialog";

function task(id: string, listId: string, overrides: Partial<TodoTask> = {}): TodoTask {
  return {
    id,
    listId,
    section: null,
    title: `Task ${id}`,
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

const lists: TodoList[] = [
  {
    id: "work",
    name: "Arbeit",
    sections: [],
    tasks: [
      task("1", "work", { title: "Login-Flow überarbeiten", tags: ["dringend"] }),
      task("2", "work", { title: "Dashboard bauen", done: true }),
    ],
  },
  {
    id: "home",
    name: "Privat",
    sections: [],
    tasks: [task("3", "home", { title: "Cache invalidieren", due: "2026-07-01" })],
  },
];

function taskButtons() {
  return screen.getAllByRole("button").filter((el) => el.textContent?.includes("Task") || true);
}

test("tippen filtert die Tasks nach Titel-Teil", async () => {
  const user = userEvent.setup();
  render(<TodoSearchDialog open onClose={vi.fn()} lists={lists} onPick={vi.fn()} />);

  await user.type(screen.getByPlaceholderText(/Aufgabe, #tag oder Liste/), "Cache");
  expect(screen.getByText("Cache invalidieren")).toBeInTheDocument();
  expect(screen.queryByText("Login-Flow überarbeiten")).not.toBeInTheDocument();
  expect(screen.queryByText("Dashboard bauen")).not.toBeInTheDocument();
});

test("filtert nach #tag", async () => {
  const user = userEvent.setup();
  render(<TodoSearchDialog open onClose={vi.fn()} lists={lists} onPick={vi.fn()} />);

  await user.type(screen.getByPlaceholderText(/Aufgabe, #tag oder Liste/), "#dringend");
  expect(screen.getByText("Login-Flow überarbeiten")).toBeInTheDocument();
  expect(screen.queryByText("Cache invalidieren")).not.toBeInTheDocument();
});

test("Klick auf ein Ergebnis ruft onPick mit dem richtigen Task", async () => {
  const onPick = vi.fn();
  const user = userEvent.setup();
  render(<TodoSearchDialog open onClose={vi.fn()} lists={lists} onPick={onPick} />);

  await user.click(screen.getByText("Cache invalidieren"));
  expect(onPick).toHaveBeenCalledWith(lists[1].tasks[0]);
});

test("offene Tasks stehen vor erledigten", () => {
  render(<TodoSearchDialog open onClose={vi.fn()} lists={lists} onPick={vi.fn()} />);

  const buttons = taskButtons();
  const open = buttons.findIndex((b) => b.textContent?.includes("Login-Flow überarbeiten"));
  const done = buttons.findIndex((b) => b.textContent?.includes("Dashboard bauen"));
  expect(open).toBeGreaterThanOrEqual(0);
  expect(done).toBeGreaterThan(open);
});

test("zeigt Leermeldung wenn keine Treffer", async () => {
  const user = userEvent.setup();
  render(<TodoSearchDialog open onClose={vi.fn()} lists={lists} onPick={vi.fn()} />);

  await user.type(screen.getByPlaceholderText(/Aufgabe, #tag oder Liste/), "xyzgarbage");
  expect(screen.getByText("Keine Aufgaben gefunden.")).toBeInTheDocument();
});
