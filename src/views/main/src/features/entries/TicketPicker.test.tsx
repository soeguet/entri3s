import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Project, Ticket } from "../../../../../shared/types";
import { TicketPicker } from "./TicketPicker";

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

test("shows the recently-used section first", () => {
  render(
    <TicketPicker
      tickets={tickets}
      projects={projects}
      recent={[tickets[0]]}
      value={null}
      onSelect={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  expect(screen.getByText("Zuletzt verwendet")).toBeInTheDocument();
});

test("groups results by project full path", () => {
  render(
    <TicketPicker
      tickets={tickets}
      projects={projects}
      recent={[]}
      value={null}
      onSelect={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  expect(screen.getByText("acme/backend/worker")).toBeInTheDocument();
  expect(screen.getByText("acme/frontend/web-app")).toBeInTheDocument();
});

test("filters by query and selects a ticket", async () => {
  const onSelect = vi.fn();
  const user = userEvent.setup();
  render(
    <TicketPicker
      tickets={tickets}
      projects={projects}
      recent={[]}
      value={null}
      onSelect={onSelect}
      onCancel={vi.fn()}
    />,
  );
  await user.type(screen.getByPlaceholderText(/Suchen/), "dark");
  await user.click(screen.getByText("Dark-Mode für Dashboard"));
  expect(onSelect).toHaveBeenCalledWith(5);
});

test("the clear option selects null", async () => {
  const onSelect = vi.fn();
  const user = userEvent.setup();
  render(
    <TicketPicker
      tickets={tickets}
      projects={projects}
      recent={[]}
      value={5}
      onSelect={onSelect}
      onCancel={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: /kein Ticket/ }));
  expect(onSelect).toHaveBeenCalledWith(null);
});

test("the back button cancels", async () => {
  const onCancel = vi.fn();
  const user = userEvent.setup();
  render(
    <TicketPicker
      tickets={tickets}
      projects={projects}
      recent={[]}
      value={null}
      onSelect={vi.fn()}
      onCancel={onCancel}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Zurück" }));
  expect(onCancel).toHaveBeenCalled();
});
