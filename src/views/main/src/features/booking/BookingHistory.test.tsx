import { test, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
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
  gitlabNoteId: 302,
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

test("rendert Buchung mit Note-Text und Link zur GitLab-Note", async () => {
  vi.mocked(api.getBookingsForEntry).mockResolvedValue({ data: [booking], error: null });

  renderWithClient(<BookingHistory entryId={2} ticketsById={ticketsById} />);

  expect(await screen.findByText("Daily Standup")).toBeInTheDocument();
  const link = screen.getByRole("link", { name: /Note #302/ });
  expect(link).toHaveAttribute(
    "href",
    "https://gitlab.example.com/group/proj/-/issues/101#note_302",
  );
  expect(link).toHaveAttribute("target", "_blank");
});

test("zeigt Hinweis ohne Buchungen", async () => {
  vi.mocked(api.getBookingsForEntry).mockResolvedValue({ data: [], error: null });

  renderWithClient(<BookingHistory entryId={2} ticketsById={ticketsById} />);

  expect(
    await screen.findByText("Gebucht vor Tracking – keine Note verlinkt."),
  ).toBeInTheDocument();
});

test("ohne Ticket-web_url kein Link, nur Note-Nummer", async () => {
  vi.mocked(api.getBookingsForEntry).mockResolvedValue({ data: [booking], error: null });

  renderWithClient(<BookingHistory entryId={2} ticketsById={new Map()} />);

  expect(await screen.findByText("Note #302")).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
