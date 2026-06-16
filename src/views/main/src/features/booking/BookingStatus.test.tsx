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

  await userEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
  expect(api.retryDeadEvent).toHaveBeenCalledWith(7);
});

test("zeigt Leermeldung ohne dead Events", async () => {
  vi.mocked(api.getDeadEvents).mockResolvedValue({ data: [], error: null });
  renderWithClient(<BookingStatus />);
  expect(await screen.findByText("Keine fehlgeschlagenen Buchungen.")).toBeInTheDocument();
});
