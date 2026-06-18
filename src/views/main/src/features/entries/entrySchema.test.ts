import { test, expect } from "vitest";
import { composeDateTime } from "./entrySchema";

test("composeDateTime in winter (CET = UTC+1)", () => {
  expect(composeDateTime("2025-01-20", "10:00", "11:30")).toEqual({
    date: "2025-01-20T09:00:00.000Z",
    durationMinutes: 90,
  });
});

test("composeDateTime in summer (CEST = UTC+2, DST-safe)", () => {
  expect(composeDateTime("2025-07-15", "10:00", "12:00")).toEqual({
    date: "2025-07-15T08:00:00.000Z",
    durationMinutes: 120,
  });
});
