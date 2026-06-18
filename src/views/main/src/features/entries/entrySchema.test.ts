import { test, expect } from "vitest";
import type { Entry } from "../../../../../shared/types";
import { withDate } from "./entrySchema";

const baseEntry: Entry = {
  id: 1,
  notes: null,
  durationMinutes: 60,
  date: "2025-01-15T09:00:00.000Z", // 10:00 Berlin (CET)
  status: "draft",
  tagIds: [],
  ticketIds: [],
  createdAt: "2025-01-15T09:00:00.000Z",
  updatedAt: "2025-01-15T09:00:00.000Z",
};

test("withDate preserves Berlin local time within the same season", () => {
  expect(withDate(baseEntry, "2025-01-20")).toBe("2025-01-20T09:00:00.000Z");
});

test("withDate preserves Berlin local time across the DST boundary", () => {
  // 10:00 Berlin im Winter (09:00 UTC) → 10:00 Berlin im Sommer = 08:00 UTC.
  expect(withDate(baseEntry, "2025-07-15")).toBe("2025-07-15T08:00:00.000Z");
});
