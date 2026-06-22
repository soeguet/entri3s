import { test, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithClient } from "../../lib/test-utils";
import { entryFixtures } from "../../fixtures/entries";
import { ticketFixtures } from "../../fixtures/tickets";
import { tagFixtures } from "../../fixtures/tags";
import { EntryList } from "./EntryList";

const ticketsById = new Map(ticketFixtures.map((t) => [t.id, t]));
const tagsById = new Map(tagFixtures.map((t) => [t.id, t]));

function noop() {}

test("rendert Entries mit Notiz und Status", () => {
  renderWithClient(
    <EntryList
      entries={entryFixtures}
      ticketsById={ticketsById}
      tagsById={tagsById}
      onEdit={noop}
      onDelete={noop}
      onBook={noop}
      onQuickEdit={noop}
      onDuplicate={noop}
    />,
  );
  expect(screen.getByText(/15\.01\.2024\s*·\s*10:00\s*[-]\s*11:30/)).toBeInTheDocument();
  expect(screen.getByText("OAuth-Redirect gefixt")).toBeInTheDocument();
  expect(screen.getByText("Gebucht")).toBeInTheDocument();
});

test("zeigt die Tags-Spalte mit Tag-Namen", () => {
  renderWithClient(
    <EntryList
      entries={entryFixtures}
      ticketsById={ticketsById}
      tagsById={tagsById}
      onEdit={noop}
      onDelete={noop}
      onBook={noop}
      onQuickEdit={noop}
      onDuplicate={noop}
    />,
  );
  // Header der neuen Spalte.
  expect(screen.getByRole("columnheader", { name: "Tags" })).toBeInTheDocument();
  // Entry 1 hat tagId 1 = "Feature".
  expect(screen.getByText("Feature")).toBeInTheDocument();
});

test("zeigt Buchen-Button nur für draft-Entry mit Ticket", () => {
  const onBook = vi.fn();
  renderWithClient(
    <EntryList
      entries={entryFixtures}
      ticketsById={ticketsById}
      tagsById={tagsById}
      onEdit={noop}
      onDelete={noop}
      onBook={onBook}
      onQuickEdit={noop}
      onDuplicate={noop}
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
      tagsById={tagsById}
      onEdit={noop}
      onDelete={noop}
      onBook={noop}
      onQuickEdit={noop}
      onDuplicate={noop}
    />,
  );
  expect(screen.getByText("Keine Entries.")).toBeInTheDocument();
});

test("zeigt Wochentag im Datum", () => {
  renderWithClient(
    <EntryList
      entries={entryFixtures}
      ticketsById={ticketsById}
      tagsById={tagsById}
      onEdit={noop}
      onDelete={noop}
      onBook={noop}
      onQuickEdit={noop}
      onDuplicate={noop}
    />,
  );
  // Entry 1 + 2 liegen am 15.01.2024 (Montag) → mehrere Treffer erwartet.
  expect(screen.getAllByText(/Mo,\s*15\.01\.2024/).length).toBeGreaterThan(0);
  // Entry 4 liegt am 17.01.2024 (Mittwoch).
  expect(screen.getByText(/Mi,\s*17\.01\.2024/)).toBeInTheDocument();
});

test("Klick auf Tags-Zelle ruft onQuickEdit mit (entry, tags)", () => {
  const onQuickEdit = vi.fn();
  renderWithClient(
    <EntryList
      entries={entryFixtures}
      ticketsById={ticketsById}
      tagsById={tagsById}
      onEdit={noop}
      onDelete={noop}
      onBook={noop}
      onQuickEdit={onQuickEdit}
      onDuplicate={noop}
    />,
  );
  // Erste Tags-Zelle anklicken; robuste Assertion ohne Annahme über die Sortier-Reihenfolge.
  fireEvent.click(screen.getAllByLabelText("Tags bearbeiten")[0]);
  expect(onQuickEdit).toHaveBeenCalledWith(
    expect.objectContaining({ id: expect.any(Number) }),
    "tags",
  );
});

test("gebuchte Zeile hat bg-success-surface", () => {
  renderWithClient(
    <EntryList
      entries={entryFixtures}
      ticketsById={ticketsById}
      tagsById={tagsById}
      onEdit={noop}
      onDelete={noop}
      onBook={noop}
      onQuickEdit={noop}
      onDuplicate={noop}
    />,
  );
  // Zeile des gebuchten Eintrags (Entry 2) über das Status-Badge finden.
  const bookedRow = screen.getByText("Gebucht").closest("tr");
  expect(bookedRow).toHaveClass("bg-success-surface");
  // Gegenprobe: nicht-gebuchte Zeile (Entry 1) ist nicht getönt.
  const draftRow = screen.getByText("OAuth-Redirect gefixt").closest("tr");
  expect(draftRow).not.toHaveClass("bg-success-surface");
});
