import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Project, Ticket } from "../../../../../shared/types";
import { TicketCombobox } from "./TicketCombobox";

const projects: Project[] = [
  { id: 43, fullPath: "acme/backend/worker", name: "Worker", syncedAt: null },
  { id: 44, fullPath: "acme/frontend/web-app", name: "Web App", syncedAt: null },
];

function ticket(id: number, iid: number, projectId: number, title: string): Ticket {
  return {
    id,
    gitlabIid: iid,
    gitlabGlobalId: 5000 + id,
    projectId,
    title,
    state: "opened",
    status: "active",
    timeEstimate: null,
    timeSpent: null,
    webUrl: null,
    syncedAt: null,
    createdAt: "",
    updatedAt: "",
  };
}

// Bewusste IID-Kollision: #1 in zwei Projekten.
const tickets: Ticket[] = [
  ticket(4, 1, 43, "Retry-Backoff im Worker"),
  ticket(5, 1, 44, "Dark-Mode für Dashboard"),
  ticket(6, 2, 44, "Mobile-Layout"),
];

test("shows placeholder, then the selected ticket with its project", () => {
  const { rerender } = render(
    <TicketCombobox
      tickets={tickets}
      projects={projects}
      recent={[]}
      value={null}
      onChange={vi.fn()}
    />,
  );
  expect(screen.getByText("– kein Ticket –")).toBeInTheDocument();

  rerender(
    <TicketCombobox
      tickets={tickets}
      projects={projects}
      recent={[]}
      value={5}
      onChange={vi.fn()}
    />,
  );
  // Projektkontext löst die mehrdeutige IID auf.
  expect(screen.getByText(/Dark-Mode für Dashboard · Web App/)).toBeInTheDocument();
});

test("opening shows the recently-used section first", async () => {
  const user = userEvent.setup();
  render(
    <TicketCombobox
      tickets={tickets}
      projects={projects}
      recent={[tickets[0]]}
      value={null}
      onChange={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: /kein Ticket/ }));
  expect(screen.getByText("Zuletzt verwendet")).toBeInTheDocument();
});

test("filters by query and selects a ticket", async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(
    <TicketCombobox
      tickets={tickets}
      projects={projects}
      recent={[]}
      value={null}
      onChange={onChange}
    />,
  );
  await user.click(screen.getByRole("button", { name: /kein Ticket/ }));
  await user.type(screen.getByPlaceholderText(/Suchen/), "dark");

  const option = screen.getByText("Dark-Mode für Dashboard");
  await user.click(option);
  expect(onChange).toHaveBeenCalledWith(5);
});

test("groups results by project full path", async () => {
  const user = userEvent.setup();
  render(
    <TicketCombobox
      tickets={tickets}
      projects={projects}
      recent={[]}
      value={null}
      onChange={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: /kein Ticket/ }));
  expect(screen.getByText("acme/backend/worker")).toBeInTheDocument();
  expect(screen.getByText("acme/frontend/web-app")).toBeInTheDocument();
});

test("the clear option resets the selection", async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(
    <TicketCombobox
      tickets={tickets}
      projects={projects}
      recent={[]}
      value={5}
      onChange={onChange}
    />,
  );
  await user.click(screen.getByRole("button", { name: /Dark-Mode/ }));
  await user.click(screen.getByRole("button", { name: /kein Ticket/ }));
  expect(onChange).toHaveBeenCalledWith(null);
});
