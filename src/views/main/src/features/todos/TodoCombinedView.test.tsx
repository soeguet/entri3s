import { test, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TodoList, TodoTask } from "../../../../../shared/types";
import { TodoCombinedView } from "./TodoCombinedView";

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

// Zwei Listen mit GLEICHNAMIGER Sektion "Heute" — jede Sektion muss unter ihrem
// eigenen Listen-Header erscheinen (keine Vermischung über Listen).
const groups: Array<{ list: TodoList; tasks: TodoTask[] }> = [
  {
    list: { id: "Arbeit", name: "Arbeit", sections: ["Heute"], tasks: [] },
    tasks: [task({ id: "Arbeit#0", listId: "Arbeit", section: "Heute", title: "A-Task" })],
  },
  {
    list: { id: "Privat", name: "Privat", sections: ["Heute"], tasks: [] },
    tasks: [task({ id: "Privat#0", listId: "Privat", section: "Heute", title: "P-Task" })],
  },
];

function noop() {}

function renderView(over: Partial<Parameters<typeof TodoCombinedView>[0]> = {}) {
  return render(
    <TodoCombinedView
      groups={groups}
      selectedId={null}
      listNames={["Arbeit", "Privat"]}
      errorTaskId={null}
      error={null}
      onSelect={noop}
      onToggle={noop}
      onRename={noop}
      onReschedule={noop}
      onMove={noop}
      onOpenDetail={noop}
      onDelete={noop}
      selectMode={false}
      selectedIds={new Set()}
      onSelectBulk={noop}
      {...over}
    />,
  );
}

test("zwei Listen mit gleichnamiger Sektion: je eigener Listen-Header", () => {
  renderView();
  const arbeit = screen.getByRole("region", { name: "Arbeit" });
  const privat = screen.getByRole("region", { name: "Privat" });
  expect(within(arbeit).getByText("A-Task")).toBeInTheDocument();
  expect(within(arbeit).queryByText("P-Task")).not.toBeInTheDocument();
  expect(within(privat).getByText("P-Task")).toBeInTheDocument();
  // Die Sektion "Heute" erscheint unter BEIDEN Headern.
  expect(within(arbeit).getByText("Heute")).toBeInTheDocument();
  expect(within(privat).getByText("Heute")).toBeInTheDocument();
});

test("onToggle ruft mit korrekter listId der jeweiligen Liste", async () => {
  const onToggle = vi.fn();
  const user = userEvent.setup();
  renderView({ onToggle });
  await user.click(screen.getByLabelText("P-Task abhaken"));
  expect(onToggle).toHaveBeenCalledWith(
    expect.objectContaining({ id: "Privat#0", listId: "Privat" }),
  );
});

test("onDelete ruft mit korrekter listId", async () => {
  const onDelete = vi.fn();
  const user = userEvent.setup();
  renderView({ onDelete });
  const arbeit = screen.getByRole("region", { name: "Arbeit" });
  await user.click(within(arbeit).getByLabelText("Aufgabe löschen"));
  await user.click(await screen.findByRole("button", { name: "Löschen" }));
  expect(onDelete).toHaveBeenCalledWith(
    expect.objectContaining({ id: "Arbeit#0", listId: "Arbeit" }),
  );
});

test("onMove ruft mit korrekter listId und Ziel-Liste", async () => {
  const onMove = vi.fn();
  const user = userEvent.setup();
  renderView({ onMove });
  const arbeit = screen.getByRole("region", { name: "Arbeit" });
  await user.click(within(arbeit).getByLabelText("In andere Liste verschieben"));
  // Move-Menü bietet alle Listen außer der aktuellen (Arbeit) → "Privat".
  await user.click(await screen.findByRole("button", { name: "Privat" }));
  expect(onMove).toHaveBeenCalledWith(
    expect.objectContaining({ id: "Arbeit#0", listId: "Arbeit" }),
    "Privat",
  );
});

test("kein Reorder-Handle (reorderable=false)", () => {
  renderView();
  expect(screen.queryByLabelText("Aufgabe umsortieren")).not.toBeInTheDocument();
});
