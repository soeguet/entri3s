import { test, expect, vi } from "vitest";
import { screen, fireEvent, within } from "@testing-library/react";
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
      onResume={noop}
      timerRunning={false}
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
      onResume={noop}
      timerRunning={false}
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
      onResume={noop}
      timerRunning={false}
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
      onResume={noop}
      timerRunning={false}
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
      onResume={noop}
      timerRunning={false}
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
      onResume={noop}
      timerRunning={false}
      onQuickEdit={onQuickEdit}
      onDuplicate={noop}
    />,
  );
  // Erste Tags-Zelle anklicken; robuste Assertion ohne Annahme über die Sortier-Reihenfolge.
  fireEvent.click(screen.getAllByLabelText("Tags bearbeiten")[0]);
  expect(onQuickEdit).toHaveBeenCalledWith(
    expect.objectContaining({ id: expect.any(Number) }),
    "tags",
    expect.any(HTMLElement),
  );
});

test("Aktionen-Modal zeigt Fortsetzen für draft, Duplizieren und Löschen", () => {
  renderWithClient(
    <EntryList
      entries={entryFixtures}
      ticketsById={ticketsById}
      tagsById={tagsById}
      onEdit={noop}
      onDelete={noop}
      onBook={noop}
      onResume={noop}
      timerRunning={false}
      onQuickEdit={noop}
      onDuplicate={noop}
    />,
  );
  // Fortsetzen/Duplizieren/Löschen stehen NICHT mehr inline in der Zeile.
  expect(screen.queryByRole("button", { name: "Duplizieren" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Löschen" })).not.toBeInTheDocument();

  // Modal für den draft-Entry (Entry 1) öffnen.
  const draftRow = screen.getByText("OAuth-Redirect gefixt").closest("tr") as HTMLElement;
  fireEvent.click(within(draftRow).getByRole("button", { name: "Weitere Aktionen" }));

  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("button", { name: "Fortsetzen" })).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Duplizieren" })).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Löschen" })).toBeInTheDocument();
});

test("Aktionen-Modal zeigt KEIN Fortsetzen für booked-Entry", () => {
  renderWithClient(
    <EntryList
      entries={entryFixtures}
      ticketsById={ticketsById}
      tagsById={tagsById}
      onEdit={noop}
      onDelete={noop}
      onBook={noop}
      onResume={noop}
      timerRunning={false}
      onQuickEdit={noop}
      onDuplicate={noop}
    />,
  );
  // Entry 2 ist booked → kein Fortsetzen im Modal.
  const bookedRow = screen.getByText("Gebucht").closest("tr") as HTMLElement;
  fireEvent.click(within(bookedRow).getByRole("button", { name: "Weitere Aktionen" }));

  const dialog = screen.getByRole("dialog");
  expect(within(dialog).queryByRole("button", { name: "Fortsetzen" })).not.toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Duplizieren" })).toBeInTheDocument();
});

test("deaktiviert Fortsetzen im Modal wenn bereits ein Timer läuft", () => {
  const onResume = vi.fn();
  renderWithClient(
    <EntryList
      entries={entryFixtures}
      ticketsById={ticketsById}
      tagsById={tagsById}
      onEdit={noop}
      onDelete={noop}
      onBook={noop}
      onResume={onResume}
      timerRunning={true}
      onQuickEdit={noop}
      onDuplicate={noop}
    />,
  );
  const draftRow = screen.getByText("OAuth-Redirect gefixt").closest("tr") as HTMLElement;
  fireEvent.click(within(draftRow).getByRole("button", { name: "Weitere Aktionen" }));

  const resumeButton = screen.getByRole("button", { name: "Fortsetzen" });
  expect(resumeButton).toBeDisabled();
  fireEvent.click(resumeButton);
  expect(onResume).not.toHaveBeenCalled();
});

test("Duplizieren im Modal ruft onDuplicate und schließt das Modal", () => {
  const onDuplicate = vi.fn();
  renderWithClient(
    <EntryList
      entries={entryFixtures}
      ticketsById={ticketsById}
      tagsById={tagsById}
      onEdit={noop}
      onDelete={noop}
      onBook={noop}
      onResume={noop}
      timerRunning={false}
      onQuickEdit={noop}
      onDuplicate={onDuplicate}
    />,
  );
  const draftRow = screen.getByText("OAuth-Redirect gefixt").closest("tr") as HTMLElement;
  fireEvent.click(within(draftRow).getByRole("button", { name: "Weitere Aktionen" }));

  fireEvent.click(screen.getByRole("button", { name: "Duplizieren" }));
  expect(onDuplicate).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  // Modal ist geschlossen.
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("Löschen im Modal ruft onDelete und schließt das Modal", () => {
  const onDelete = vi.fn();
  renderWithClient(
    <EntryList
      entries={entryFixtures}
      ticketsById={ticketsById}
      tagsById={tagsById}
      onEdit={noop}
      onDelete={onDelete}
      onBook={noop}
      onResume={noop}
      timerRunning={false}
      onQuickEdit={noop}
      onDuplicate={noop}
    />,
  );
  const draftRow = screen.getByText("OAuth-Redirect gefixt").closest("tr") as HTMLElement;
  fireEvent.click(within(draftRow).getByRole("button", { name: "Weitere Aktionen" }));

  fireEvent.click(screen.getByRole("button", { name: "Löschen" }));
  expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
      onResume={noop}
      timerRunning={false}
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
