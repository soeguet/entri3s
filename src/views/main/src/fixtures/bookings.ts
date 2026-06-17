import type { Booking } from "../../../../shared/types";

export const bookingFixtures: Booking[] = [
  {
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
  },
];
