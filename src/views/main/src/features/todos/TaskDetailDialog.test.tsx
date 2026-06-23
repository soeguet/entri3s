import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TodoTask } from "../../../../../shared/types";
import { TaskDetailDialog } from "./TaskDetailDialog";

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
    tags: ["arbeit"],
    depth: 0,
    description: null,
    ...overrides,
  };
}

function noop() {}

test("Titel ändern + Speichern ruft onUpdate mit atomarem Patch", async () => {
  const onUpdate = vi.fn();
  const user = userEvent.setup();
  render(
    <TaskDetailDialog
      open
      task={task()}
      subtasks={[]}
      onClose={noop}
      onUpdate={onUpdate}
      onAddSubtask={noop}
      onToggleSubtask={noop}
      error={null}
    />,
  );

  const title = screen.getByLabelText("Titel");
  await user.clear(title);
  await user.type(title, "Neuer Titel");
  await user.click(screen.getByRole("button", { name: "Speichern" }));

  expect(onUpdate).toHaveBeenCalledTimes(1);
  expect(onUpdate).toHaveBeenCalledWith({
    id: "L#0",
    listId: "L",
    title: "Neuer Titel",
    description: null,
    priority: "normal",
    due: "2026-06-22",
    scheduled: null,
    tags: ["arbeit"],
  });
});

test("Tags-Feld wird als Leerzeichen-getrennte Liste ohne # gespeichert", async () => {
  const onUpdate = vi.fn();
  const user = userEvent.setup();
  render(
    <TaskDetailDialog
      open
      task={task({ tags: [] })}
      subtasks={[]}
      onClose={noop}
      onUpdate={onUpdate}
      onAddSubtask={noop}
      onToggleSubtask={noop}
      error={null}
    />,
  );

  await user.type(screen.getByLabelText("Tags"), "arbeit backend");
  await user.click(screen.getByRole("button", { name: "Speichern" }));

  expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ tags: ["arbeit", "backend"] }));
});

test("Subtask hinzufügen ruft onAddSubtask mit dem Titel", async () => {
  const onAddSubtask = vi.fn();
  const user = userEvent.setup();
  render(
    <TaskDetailDialog
      open
      task={task()}
      subtasks={[]}
      onClose={noop}
      onUpdate={noop}
      onAddSubtask={onAddSubtask}
      onToggleSubtask={noop}
      error={null}
    />,
  );

  await user.type(screen.getByLabelText("Neuer Subtask"), "Unteraufgabe");
  await user.click(screen.getByRole("button", { name: "Hinzufügen" }));

  expect(onAddSubtask).toHaveBeenCalledWith("Unteraufgabe");
});

test("Subtask-Checkbox ruft onToggleSubtask", async () => {
  const onToggleSubtask = vi.fn();
  const sub = task({ id: "L#1", title: "Sub", depth: 1 });
  const user = userEvent.setup();
  render(
    <TaskDetailDialog
      open
      task={task()}
      subtasks={[sub]}
      onClose={noop}
      onUpdate={noop}
      onAddSubtask={noop}
      onToggleSubtask={onToggleSubtask}
      error={null}
    />,
  );

  await user.click(screen.getByLabelText("Sub abhaken"));
  expect(onToggleSubtask).toHaveBeenCalledWith(sub);
});
