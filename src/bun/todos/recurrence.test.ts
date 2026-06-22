import { test, expect } from "bun:test";
import { parseRule, computeNext } from "./recurrence";

test("parseRule: every day/week/month/year", () => {
  expect(parseRule("every day")).toEqual({ interval: 1, unit: "day", whenDone: false });
  expect(parseRule("every week")).toEqual({ interval: 1, unit: "week", whenDone: false });
  expect(parseRule("every month")).toEqual({ interval: 1, unit: "month", whenDone: false });
  expect(parseRule("every year")).toEqual({ interval: 1, unit: "year", whenDone: false });
});

test("parseRule: every N unit", () => {
  expect(parseRule("every 3 days")).toEqual({ interval: 3, unit: "day", whenDone: false });
  expect(parseRule("every 2 weeks")).toEqual({ interval: 2, unit: "week", whenDone: false });
});

test("parseRule: when done suffix", () => {
  expect(parseRule("every week when done")).toEqual({ interval: 1, unit: "week", whenDone: true });
});

test("parseRule: bare daily/weekly", () => {
  expect(parseRule("daily")).toEqual({ interval: 1, unit: "day", whenDone: false });
});

test("parseRule: unknown/complex -> null", () => {
  expect(parseRule("every 3 fortnights")).toBeNull();
  expect(parseRule("every weekday")).toBeNull();
  expect(parseRule("on the 1st of every month")).toBeNull();
  expect(parseRule("")).toBeNull();
  expect(parseRule(null)).toBeNull();
});

test("computeNext: adds interval to base date (UTC-stable)", () => {
  const r = parseRule("every day")!;
  expect(computeNext(r, "2026-06-22", "2026-06-22")).toBe("2026-06-23");
});

test("computeNext: month rollover", () => {
  const r = parseRule("every month")!;
  expect(computeNext(r, "2026-01-31", "2026-01-31")).toBe("2026-03-03"); // JS month math
});

test("computeNext: when done anchors on today", () => {
  const r = parseRule("every week when done")!;
  expect(computeNext(r, "2026-06-01", "2026-06-22")).toBe("2026-06-29");
});

test("computeNext: no base and not when-done -> null", () => {
  const r = parseRule("every day")!;
  expect(computeNext(r, null, "2026-06-22")).toBeNull();
});
