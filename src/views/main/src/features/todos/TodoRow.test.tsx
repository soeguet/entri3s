import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TodoTask } from "../../../../../shared/types";
import { RpcError } from "../../lib/errors";
import { TodoRow } from "./TodoRow";

function task(overrides: Partial<TodoTask> = {}): TodoTask {
  return {
    id: "L#0",
    listId: "L",
    section: null,
    title: "Test-Task",
    done: false,
    priority: "normal",
    due: "2026-06-22",
    scheduled: null,
    start: null,
    created: null,
    doneDate: null,
    recurrence: null,
    recurrenceEditableInApp: true,
    tags: [],
    depth: 0,
    ...overrides,
  };
}

function noop() {}

test("Checkbox-Klick ruft onToggle", async () => {
  const onToggle = vi.fn();
  const user = userEvent.setup();
  render(
    <TodoRow
      task={task()}
      selected={false}
      error={null}
      onSelect={noop}
      onToggle={onToggle}
      onRename={noop}
      onReschedule={noop}
    />,
  );
  await user.click(screen.getByLabelText("Test-Task abhaken"));
  expect(onToggle).toHaveBeenCalledTimes(1);
});

test("read-only-Recurrence: Checkbox deaktiviert + Obsidian-Badge", () => {
  render(
    <TodoRow
      task={task({ recurrence: "every 2nd tuesday", recurrenceEditableInApp: false })}
      selected={false}
      error={null}
      onSelect={noop}
      onToggle={noop}
      onRename={noop}
      onReschedule={noop}
    />,
  );
  expect(screen.getByLabelText("Test-Task abhaken")).toBeDisabled();
  expect(screen.getByText("in Obsidian abhaken")).toBeInTheDocument();
});

test("Konflikt-Fehler zeigt die Spec-Botschaft", () => {
  render(
    <TodoRow
      task={task()}
      selected={false}
      error={new RpcError({ code: "TODO_CONFLICT", message: "egal", retry: false })}
      onSelect={noop}
      onToggle={noop}
      onRename={noop}
      onReschedule={noop}
    />,
  );
  expect(screen.getByText("Aufgabe wurde extern geändert, nicht gespeichert")).toBeInTheDocument();
});

test("Inline-Edit ist BLUR-ONLY und ruft onRename mit neuem Titel", async () => {
  const onRename = vi.fn();
  const user = userEvent.setup();
  render(
    <TodoRow
      task={task()}
      selected={false}
      error={null}
      onSelect={noop}
      onToggle={noop}
      onRename={onRename}
      onReschedule={noop}
    />,
  );
  await user.dblClick(screen.getByText("Test-Task"));
  const edit = screen.getByLabelText("Titel bearbeiten");
  await user.clear(edit);
  await user.type(edit, "Neuer Titel");
  // Während des Tippens NICHT gespeichert.
  expect(onRename).not.toHaveBeenCalled();
  await user.tab(); // Blur
  expect(onRename).toHaveBeenCalledWith("Neuer Titel");
});
