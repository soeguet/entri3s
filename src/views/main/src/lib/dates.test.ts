import { test, expect } from "vitest";
import {
  formatDuration,
  formatDate,
  formatWeekday,
  rangeForPreset,
  shiftDay,
  singleDayBase,
  todayBerlinYmd,
} from "./dates";

test("formatDuration formats minutes", () => {
  expect(formatDuration(45)).toBe("45m");
  expect(formatDuration(60)).toBe("1h");
  expect(formatDuration(90)).toBe("1h 30m");
});

test("formatDate renders in Europe/Berlin", () => {
  expect(formatDate("2024-01-15T09:00:00.000Z")).toBe("15.01.2024");
});

test("rangeForPreset computes ranges anchored to Berlin today", () => {
  // Mittwoch, 12.06.2024 (Woche Mo 10.06 – So 16.06).
  const now = new Date("2024-06-12T10:00:00.000Z");
  expect(rangeForPreset("today", now)).toEqual({ from: "2024-06-12", to: "2024-06-12" });
  expect(rangeForPreset("yesterday", now)).toEqual({ from: "2024-06-11", to: "2024-06-11" });
  expect(rangeForPreset("thisWeek", now)).toEqual({ from: "2024-06-10", to: "2024-06-16" });
  expect(rangeForPreset("lastWeek", now)).toEqual({ from: "2024-06-03", to: "2024-06-09" });
  expect(rangeForPreset("thisMonth", now)).toEqual({ from: "2024-06-01", to: "2024-06-30" });
  expect(rangeForPreset("lastMonth", now)).toEqual({ from: "2024-05-01", to: "2024-05-31" });
});

test("rangeForPreset uses the Berlin calendar day across UTC midnight", () => {
  // 22:30 UTC = 00:30 in Berlin (CEST) am Folgetag.
  const now = new Date("2024-06-12T22:30:00.000Z");
  expect(rangeForPreset("today", now)).toEqual({ from: "2024-06-13", to: "2024-06-13" });
  expect(rangeForPreset("yesterday", now)).toEqual({ from: "2024-06-12", to: "2024-06-12" });
});

test("formatWeekday renders German short weekdays in Europe/Berlin", () => {
  expect(formatWeekday("2024-01-15T09:00:00.000Z")).toBe("Mo");
  expect(formatWeekday("2024-01-17T11:00:00.000Z")).toBe("Mi");
  // 22:30 UTC Sa = 00:30 CEST So (16.06.) in Berlin.
  expect(formatWeekday("2024-06-15T22:30:00.000Z")).toBe("So");
});

test("shiftDay shifts by calendar days", () => {
  expect(shiftDay("2026-03-15", 1)).toBe("2026-03-16");
  expect(shiftDay("2026-03-15", -1)).toBe("2026-03-14");
});

test("shiftDay crosses month boundaries", () => {
  // Februar → März (kein Schaltjahr 2026)
  expect(shiftDay("2026-02-28", 1)).toBe("2026-03-01");
  // Schaltjahr 2024: 28. Feb → 29. Feb
  expect(shiftDay("2024-02-28", 1)).toBe("2024-02-29");
});

test("shiftDay crosses year boundaries", () => {
  expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
  expect(shiftDay("2025-12-31", 1)).toBe("2026-01-01");
});

test("todayBerlinYmd returns yyyy-MM-dd for a given now", () => {
  const now = new Date("2026-06-22T10:00:00.000Z");
  expect(todayBerlinYmd(now)).toBe("2026-06-22");
  // 22:30 UTC = 00:30 CEST am Folgetag in Berlin
  const late = new Date("2026-06-22T22:30:00.000Z");
  expect(todayBerlinYmd(late)).toBe("2026-06-23");
});

test("singleDayBase falls back to today when from and to are empty", () => {
  expect(singleDayBase("", "", "2026-06-22")).toBe("2026-06-22");
});

test("singleDayBase returns the single day when from === to and set", () => {
  expect(singleDayBase("2026-06-16", "2026-06-16", "2026-06-22")).toBe("2026-06-16");
});

test("singleDayBase returns from when range is active (from !== to)", () => {
  expect(singleDayBase("2026-06-10", "2026-06-12", "2026-06-22")).toBe("2026-06-10");
});

test("singleDayBase returns to when only to is set", () => {
  expect(singleDayBase("", "2026-06-12", "2026-06-22")).toBe("2026-06-12");
});

test("shiftDay(singleDayBase) does not crash on empty filters", () => {
  expect(shiftDay(singleDayBase("", "", "2026-06-22"), -1)).toBe("2026-06-21");
});
