import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Project, Ticket } from "../../../../../shared/types";
import { TicketSearchDialog } from "./TicketSearchDialog";

function ticket(id: number, overrides: Partial<Ticket> = {}): Ticket {
  return {
    id,
    gitlabIid: 100 + id,
    gitlabGlobalId: 5000 + id,
    projectId: 42,
    title: `Ticket ${id}`,
    state: "opened",
    status: "active",
    timeEstimate: null,
    timeSpent: null,
    webUrl: null,
    assignees: [],
    description: null,
    descriptionHtml: null,
    labels: [],
    author: null,
    milestoneTitle: null,
    dueDate: null,
    issueCreatedAt: null,
    pinned: false,
    unread: false,
    lastViewedAt: null,
    notesCount: 0,
    syncedAt: null,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

const projects: Project[] = [
  { id: 42, fullPath: "acme/backend/api", name: "api", syncedAt: null },
  { id: 7, fullPath: "acme/frontend/web", name: "web", syncedAt: null },
];

const tickets: Ticket[] = [
  ticket(1, { gitlabIid: 201, title: "Login-Flow überarbeiten", projectId: 42, pinned: false }),
  ticket(2, { gitlabIid: 105, title: "Dashboard bauen", projectId: 7, pinned: true }),
  ticket(3, { gitlabIid: 310, title: "Cache invalidieren", projectId: 42, pinned: false }),
];

function ticketButtons() {
  return screen.getAllByRole("button").filter((el) => el.textContent?.includes("#"));
}

test("zeigt alle Tickets, gepinnte zuerst dann nach IID aufsteigend", () => {
  render(
    <TicketSearchDialog
      open
      onClose={vi.fn()}
      tickets={tickets}
      projects={projects}
      onPick={vi.fn()}
    />,
  );

  const buttons = ticketButtons();
  expect(buttons).toHaveLength(3);
  // pinned (Ticket 2, iid 105) zuerst, dann nach iid: 201, 310.
  expect(buttons[0]).toHaveTextContent("Dashboard bauen");
  expect(buttons[1]).toHaveTextContent("Login-Flow überarbeiten");
  expect(buttons[2]).toHaveTextContent("Cache invalidieren");
});

test("filtert nach #IID", async () => {
  const user = userEvent.setup();
  render(
    <TicketSearchDialog
      open
      onClose={vi.fn()}
      tickets={tickets}
      projects={projects}
      onPick={vi.fn()}
    />,
  );

  await user.type(screen.getByPlaceholderText(/#IID, Titel oder Projekt/), "#201");
  const buttons = ticketButtons();
  expect(buttons).toHaveLength(1);
  expect(buttons[0]).toHaveTextContent("Login-Flow überarbeiten");
});

test("filtert nach Titel-Teil", async () => {
  const user = userEvent.setup();
  render(
    <TicketSearchDialog
      open
      onClose={vi.fn()}
      tickets={tickets}
      projects={projects}
      onPick={vi.fn()}
    />,
  );

  await user.type(screen.getByPlaceholderText(/#IID, Titel oder Projekt/), "Cache");
  const buttons = ticketButtons();
  expect(buttons).toHaveLength(1);
  expect(buttons[0]).toHaveTextContent("Cache invalidieren");
});

test("filtert nach Projektpfad", async () => {
  const user = userEvent.setup();
  render(
    <TicketSearchDialog
      open
      onClose={vi.fn()}
      tickets={tickets}
      projects={projects}
      onPick={vi.fn()}
    />,
  );

  await user.type(screen.getByPlaceholderText(/#IID, Titel oder Projekt/), "frontend");
  const buttons = ticketButtons();
  expect(buttons).toHaveLength(1);
  expect(buttons[0]).toHaveTextContent("Dashboard bauen");
});

test("Klick auf ein Ticket ruft onPick mit dem richtigen Ticket", async () => {
  const onPick = vi.fn();
  const user = userEvent.setup();
  render(
    <TicketSearchDialog
      open
      onClose={vi.fn()}
      tickets={tickets}
      projects={projects}
      onPick={onPick}
    />,
  );

  await user.click(screen.getByText("Cache invalidieren"));
  expect(onPick).toHaveBeenCalledWith(tickets[2]);
});

test("Enter wählt das hervorgehobene Ticket", async () => {
  const onPick = vi.fn();
  const user = userEvent.setup();
  render(
    <TicketSearchDialog
      open
      onClose={vi.fn()}
      tickets={tickets}
      projects={projects}
      onPick={onPick}
    />,
  );

  const input = screen.getByPlaceholderText(/#IID, Titel oder Projekt/);
  await user.type(input, "Cache");
  await user.keyboard("{Enter}");
  expect(onPick).toHaveBeenCalledWith(tickets[2]);
});

test("zeigt Leermeldung wenn keine Treffer", async () => {
  const user = userEvent.setup();
  render(
    <TicketSearchDialog
      open
      onClose={vi.fn()}
      tickets={tickets}
      projects={projects}
      onPick={vi.fn()}
    />,
  );

  await user.type(screen.getByPlaceholderText(/#IID, Titel oder Projekt/), "xyzgarbage");
  expect(screen.getByText("Keine Tickets gefunden.")).toBeInTheDocument();
});
