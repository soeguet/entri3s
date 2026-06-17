import { test, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "../../lib/test-utils";
import type { Entry } from "../../../../../shared/types";
import * as api from "../../api";
import { RunningTimerWidget } from "./RunningTimerWidget";

vi.mock("../../api");

beforeEach(() => {
  vi.clearAllMocks();
});

function runningEntry(): Entry {
  return {
    id: 7,
    notes: "Login-Bug",
    durationMinutes: 0,
    date: new Date(Date.now() - 60 * 60_000).toISOString(), // vor 1 Stunde
    status: "running",
    tagIds: [],
    ticketIds: [],
    createdAt: "",
    updatedAt: "",
  };
}

test("startet einen Timer mit eingegebener Notiz", async () => {
  vi.mocked(api.getRunningEntry).mockResolvedValue({ data: null, error: null });
  const user = userEvent.setup();
  renderWithClient(<RunningTimerWidget />);

  await user.type(screen.getByPlaceholderText("Woran arbeitest du?"), "Neue Aufgabe");
  await user.click(screen.getByRole("button", { name: /Start/ }));

  await vi.waitFor(() =>
    expect(api.startEntry).toHaveBeenCalledWith({ ticketId: null, notes: "Neue Aufgabe" }),
  );
});

test("speichert die Notiz beim Verlassen des Feldes (Autosave)", async () => {
  vi.mocked(api.getRunningEntry).mockResolvedValue({ data: runningEntry(), error: null });
  const user = userEvent.setup();
  renderWithClient(<RunningTimerWidget />);

  const field = await screen.findByPlaceholderText("Notiz…");
  await user.clear(field);
  await user.type(field, "Refactoring");
  await user.tab(); // löst onBlur aus

  await vi.waitFor(() => expect(api.setEntryNotes).toHaveBeenCalledWith(7, "Refactoring"));
});

test("zeigt die Live-Dauer und stoppt den laufenden Timer", async () => {
  vi.mocked(api.getRunningEntry).mockResolvedValue({ data: runningEntry(), error: null });
  const user = userEvent.setup();
  renderWithClient(<RunningTimerWidget />);

  // ~1h Laufzeit → Anzeige beginnt mit "01:".
  await screen.findByText(/^01:/);
  await user.click(screen.getByRole("button", { name: /Stop/ }));

  await vi.waitFor(() => expect(api.stopEntry).toHaveBeenCalledWith(7));
});

test("verwirft den laufenden Timer nach Bestätigung", async () => {
  vi.mocked(api.getRunningEntry).mockResolvedValue({ data: runningEntry(), error: null });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const user = userEvent.setup();
  renderWithClient(<RunningTimerWidget />);

  await user.click(await screen.findByRole("button", { name: "Timer verwerfen" }));

  await vi.waitFor(() => expect(api.deleteEntry).toHaveBeenCalledWith(7));
});

test("verwirft nichts, wenn die Bestätigung abgelehnt wird", async () => {
  vi.mocked(api.getRunningEntry).mockResolvedValue({ data: runningEntry(), error: null });
  vi.spyOn(window, "confirm").mockReturnValue(false);
  const user = userEvent.setup();
  renderWithClient(<RunningTimerWidget />);

  await user.click(await screen.findByRole("button", { name: "Timer verwerfen" }));

  expect(api.deleteEntry).not.toHaveBeenCalled();
});
