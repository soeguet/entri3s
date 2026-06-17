import { test, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Booking, Ticket } from "../../../../../shared/types";
import { renderWithClient } from "../../lib/test-utils";
import { ticketFixtures } from "../../fixtures/tickets";
import * as api from "../../api";
import { BookingHistory } from "./BookingHistory";

vi.mock("../../api");

const ticketsById = new Map<number, Ticket>(ticketFixtures.map((t) => [t.id, t]));

const booking: Booking = {
  id: 1,
  entryId: 2,
  ticketId: 1,
  gitlabTimelogId: 302,
  projectId: 42,
  issueIid: 101,
  durationMinutes: 15,
  note: "Daily Standup",
  spentAt: "2024-01-15",
  bookedAt: "2024-01-15T08:46:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

test("rendert Buchung mit Summary-Text und Link zum Issue", async () => {
  vi.mocked(api.getBookingsForEntry).mockResolvedValue({ data: [booking], error: null });

  renderWithClient(<BookingHistory entryId={2} ticketsById={ticketsById} />);

  expect(await screen.findByText("Daily Standup")).toBeInTheDocument();
  const link = screen.getByRole("link", { name: /Timelog #302/ });
  expect(link).toHaveAttribute("href", "https://gitlab.example.com/group/proj/-/issues/101");
  expect(link).toHaveAttribute("target", "_blank");
});

test("löscht eine Buchung über den Löschen-Button", async () => {
  vi.mocked(api.getBookingsForEntry).mockResolvedValue({ data: [booking], error: null });
  vi.mocked(api.deleteBooking).mockResolvedValue({ data: undefined, error: null });
  const user = userEvent.setup();

  renderWithClient(<BookingHistory entryId={2} ticketsById={ticketsById} />);

  await user.click(await screen.findByRole("button", { name: "Löschen" }));
  await vi.waitFor(() => expect(api.deleteBooking).toHaveBeenCalledWith(1));
});

test("zeigt Hinweis ohne Buchungen", async () => {
  vi.mocked(api.getBookingsForEntry).mockResolvedValue({ data: [], error: null });

  renderWithClient(<BookingHistory entryId={2} ticketsById={ticketsById} />);

  expect(
    await screen.findByText("Gebucht vor Tracking – kein Timelog verlinkt."),
  ).toBeInTheDocument();
});

test("ohne Ticket-web_url kein Link, nur Timelog-Nummer", async () => {
  vi.mocked(api.getBookingsForEntry).mockResolvedValue({ data: [booking], error: null });

  renderWithClient(<BookingHistory entryId={2} ticketsById={new Map()} />);

  expect(await screen.findByText("Timelog #302")).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
