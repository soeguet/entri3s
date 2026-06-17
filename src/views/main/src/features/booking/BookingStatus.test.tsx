import { test, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "../../lib/test-utils";
import * as api from "../../api";
import { BookingStatus } from "./BookingStatus";

vi.mock("../../api");

beforeEach(() => {
  vi.clearAllMocks();
});

test("listet dead Events mit Fehler und Retry-Button", async () => {
  vi.mocked(api.getDeadEvents).mockResolvedValue({
    data: [
      {
        id: 7,
        type: "booking",
        status: "dead",
        error: "GitLab down",
        createdAt: "2024-01-15T10:00:00.000Z",
      },
    ],
    error: null,
  });

  renderWithClient(<BookingStatus />);

  expect(await screen.findByText("GitLab down")).toBeInTheDocument();
  // Interner Event-Typ wird als verständliches Label angezeigt.
  expect(screen.getByText("Buchung fehlgeschlagen")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
  expect(api.retryDeadEvent).toHaveBeenCalledWith(7);
});

test("verwirft ein dead Event über den Verwerfen-Button", async () => {
  vi.mocked(api.getDeadEvents).mockResolvedValue({
    data: [
      {
        id: 9,
        type: "booking_delete",
        status: "dead",
        error: "The resource does not exist",
        createdAt: "2024-01-15T10:00:00.000Z",
      },
    ],
    error: null,
  });

  renderWithClient(<BookingStatus />);

  // booking_delete bekommt sein eigenes Label.
  expect(await screen.findByText("Stornierung fehlgeschlagen")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Verwerfen" }));
  expect(api.discardDeadEvent).toHaveBeenCalledWith(9);
});

test("zeigt Leermeldung ohne dead Events", async () => {
  vi.mocked(api.getDeadEvents).mockResolvedValue({ data: [], error: null });
  renderWithClient(<BookingStatus />);
  expect(await screen.findByText("Keine fehlgeschlagenen Buchungen.")).toBeInTheDocument();
});
