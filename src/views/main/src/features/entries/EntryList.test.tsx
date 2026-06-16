import { test, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithClient } from "../../lib/test-utils";
import { entryFixtures } from "../../fixtures/entries";
import { ticketFixtures } from "../../fixtures/tickets";
import { EntryList } from "./EntryList";

const ticketsById = new Map(ticketFixtures.map((t) => [t.id, t]));

function noop() {}

test("rendert Entries mit Titel und Status", () => {
  renderWithClient(
    <EntryList
      entries={entryFixtures}
      ticketsById={ticketsById}
      onEdit={noop}
      onDelete={noop}
      onBook={noop}
    />,
  );
  expect(screen.getByText("Login-Flow implementiert")).toBeInTheDocument();
  expect(screen.getByText("Gebucht")).toBeInTheDocument();
});

test("zeigt Buchen-Button nur für draft-Entry mit Ticket", () => {
  const onBook = vi.fn();
  renderWithClient(
    <EntryList
      entries={entryFixtures}
      ticketsById={ticketsById}
      onEdit={noop}
      onDelete={noop}
      onBook={onBook}
    />,
  );
  // Fixtures: nur Entry 1 (draft + Ticket) ist buchbar.
  const bookButtons = screen.getAllByRole("button", { name: "Buchen" });
  expect(bookButtons).toHaveLength(1);
});

test("zeigt Leermeldung ohne Entries", () => {
  renderWithClient(
    <EntryList
      entries={[]}
      ticketsById={ticketsById}
      onEdit={noop}
      onDelete={noop}
      onBook={noop}
    />,
  );
  expect(screen.getByText("Keine Entries.")).toBeInTheDocument();
});
