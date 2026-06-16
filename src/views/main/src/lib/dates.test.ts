import { test, expect } from "vitest";
import { formatDuration, formatDate } from "./dates";

test("formatDuration formats minutes", () => {
  expect(formatDuration(45)).toBe("45m");
  expect(formatDuration(60)).toBe("1h");
  expect(formatDuration(90)).toBe("1h 30m");
});

test("formatDate renders in Europe/Berlin", () => {
  expect(formatDate("2024-01-15T09:00:00.000Z")).toBe("15.01.2024");
});
