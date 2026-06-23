import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TodoList } from "../../../../../shared/types";
import { LIST_DELIMITER } from "./listHierarchy";
import { TodoSidebar } from "./TodoSidebar";
import type { SmartView } from "./smartViewFilter";

function list(id: string, name: string): TodoList {
  return { id, name, sections: [], tasks: [] };
}

const counts: Record<SmartView, number> = { today: 0, overdue: 0, upcoming: 0, all: 0 };

// Parent "Arbeit" mit Child "Arbeit~Backend" — eine Hierarchie-Ebene.
const lists: TodoList[] = [
  list("Arbeit", "Arbeit"),
  list(`Arbeit${LIST_DELIMITER}Backend`, `Arbeit${LIST_DELIMITER}Backend`),
];

function renderSidebar(overrides: Partial<Parameters<typeof TodoSidebar>[0]> = {}) {
  const props = {
    lists,
    counts,
    view: "today" as SmartView,
    selectedList: null,
    onView: vi.fn(),
    onList: vi.fn(),
    onCreateList: vi.fn(),
    createError: null,
    savedFilters: [],
    onApplyFilter: vi.fn(),
    onDeleteFilter: vi.fn(),
    onSaveCurrent: vi.fn(),
    ...overrides,
  };
  render(<TodoSidebar {...props} />);
  return props;
}

test("rendert Parent und verschachteltes Child mit Child-Label", () => {
  renderSidebar();
  // Parent-Header zeigt das Parent-Segment.
  expect(screen.getByText("Arbeit")).toBeInTheDocument();
  // Child zeigt nur das Child-Segment, nicht den vollen Namen.
  expect(screen.getByText("Backend")).toBeInTheDocument();
  expect(screen.queryByText(`Arbeit${LIST_DELIMITER}Backend`)).not.toBeInTheDocument();
});

test("Klick auf Child ruft onList mit der vollen id", async () => {
  const user = userEvent.setup();
  const props = renderSidebar();
  await user.click(screen.getByText("Backend"));
  expect(props.onList).toHaveBeenCalledWith(`Arbeit${LIST_DELIMITER}Backend`);
});

test("Anlegen einer Unterliste ruft onCreateList mit Parent + Delimiter + Name", async () => {
  const user = userEvent.setup();
  const props = renderSidebar();

  await user.click(screen.getByLabelText("Unterliste in Arbeit anlegen"));
  await user.type(screen.getByLabelText("Unterliste in Arbeit"), "Frontend");
  await user.click(screen.getByLabelText("Unterliste anlegen"));

  expect(props.onCreateList).toHaveBeenCalledWith(`Arbeit${LIST_DELIMITER}Frontend`);
});
