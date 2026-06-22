import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Entry, Ticket } from "../../../../../shared/types";
import { EntrySearchDialog } from "./EntrySearchDialog";

function entry(id: number, overrides: Partial<Entry> = {}): Entry {
  return {
    id,
    notes: null,
    durationMinutes: 60,
    date: "2024-01-15T09:00:00.000Z",
    status: "draft",
    tagIds: [],
    ticketIds: [],
    createdAt: "2024-01-15T09:00:00.000Z",
    updatedAt: "2024-01-15T09:00:00.000Z",
    ...overrides,
  };
}

const ticket1: Ticket = {
  id: 1,
  gitlabIid: 101,
  gitlabGlobalId: 5101,
  projectId: 42,
  title: "Login-Flow überarbeiten",
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
};

const entries: Entry[] = [
  entry(1, {
    notes: "OAuth-Redirect gefixt",
    date: "2024-01-15T09:00:00.000Z",
    ticketIds: [1],
    createdAt: "2024-01-15T09:00:00.000Z",
  }),
  entry(2, {
    notes: "Meeting vorbereitet",
    date: "2024-01-16T08:00:00.000Z",
    createdAt: "2024-01-16T10:00:00.000Z",
  }),
  entry(3, {
    notes: "Flamegraph aufgenommen",
    date: "2024-01-14T13:00:00.000Z",
    createdAt: "2024-01-17T13:00:00.000Z",
  }),
];

const ticketsById = new Map([[1, ticket1]]);

test("zeigt Entries sortiert nach createdAt DESC", () => {
  render(
    <EntrySearchDialog
      open
      onClose={vi.fn()}
      entries={entries}
      ticketsById={ticketsById}
      onPick={vi.fn()}
    />,
  );

  const buttons = screen
    .getAllByRole("button")
    .filter((el) => el.textContent?.includes(".01.2024"));
  // Reihenfolge: Entry 3 (createdAt 17.01), Entry 2 (createdAt 16.01), Entry 1 (createdAt 15.01)
  expect(buttons[0]).toHaveTextContent("Flamegraph aufgenommen");
  expect(buttons[1]).toHaveTextContent("Meeting vorbereitet");
  expect(buttons[2]).toHaveTextContent("OAuth-Redirect gefixt");
});

test("filtert nach Suchbegriff in Notizen", async () => {
  const user = userEvent.setup();
  render(
    <EntrySearchDialog
      open
      onClose={vi.fn()}
      entries={entries}
      ticketsById={ticketsById}
      onPick={vi.fn()}
    />,
  );

  await user.type(screen.getByPlaceholderText(/Notiz, Datum oder Ticket/), "Flamegraph");
  const buttons = screen
    .getAllByRole("button")
    .filter((el) => el.textContent?.includes(".01.2024"));
  expect(buttons).toHaveLength(1);
  expect(buttons[0]).toHaveTextContent("Flamegraph aufgenommen");
});

test("Klick auf Entry ruft onPick", async () => {
  const onPick = vi.fn();
  const user = userEvent.setup();
  render(
    <EntrySearchDialog
      open
      onClose={vi.fn()}
      entries={entries}
      ticketsById={ticketsById}
      onPick={onPick}
    />,
  );

  await user.click(screen.getByText("OAuth-Redirect gefixt"));
  expect(onPick).toHaveBeenCalledWith(entries[0]);
});

test("filtert nach Ticket-IID", async () => {
  const user = userEvent.setup();
  render(
    <EntrySearchDialog
      open
      onClose={vi.fn()}
      entries={entries}
      ticketsById={ticketsById}
      onPick={vi.fn()}
    />,
  );

  await user.type(screen.getByPlaceholderText(/Notiz, Datum oder Ticket/), "#101");
  const buttons = screen
    .getAllByRole("button")
    .filter((el) => el.textContent?.includes(".01.2024"));
  expect(buttons).toHaveLength(1);
  expect(buttons[0]).toHaveTextContent("OAuth-Redirect gefixt");
});

test("zeigt Leermeldung wenn keine Treffer", async () => {
  const user = userEvent.setup();
  render(
    <EntrySearchDialog
      open
      onClose={vi.fn()}
      entries={entries}
      ticketsById={ticketsById}
      onPick={vi.fn()}
    />,
  );

  await user.type(screen.getByPlaceholderText(/Notiz, Datum oder Ticket/), "xyzgarbage");
  expect(screen.getByText("Keine Entries gefunden.")).toBeInTheDocument();
});
