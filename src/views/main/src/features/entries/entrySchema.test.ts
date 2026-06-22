import { test, expect } from "vitest";
import { composeDateTime, makeEmptyFormValues, roundedNowHHmm, shiftHHmm } from "./entrySchema";

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

// -- makeEmptyFormValues --

test("makeEmptyFormValues uses rounded Berlin time from now", () => {
  // 2025-07-15 14:37 Berlin (CEST = UTC+2) → rounded to 14:35, end 15:35
  const now = new Date("2025-07-15T12:37:00.000Z");
  const result = makeEmptyFormValues({ now });
  expect(result.startTime).toBe("14:35");
  expect(result.endTime).toBe("15:35");
  expect(result.date).toBe("2025-07-15");
  expect(result.notes).toBe("");
  expect(result.tagIds).toEqual([]);
  expect(result.ticketId).toBeNull();
});

test("makeEmptyFormValues rounds up to nearest 5 min", () => {
  // 2025-01-20 09:03 Berlin (CET = UTC+1) → rounded to 09:05, end 10:05
  const now = new Date("2025-01-20T08:03:00.000Z");
  const result = makeEmptyFormValues({ now });
  expect(result.startTime).toBe("09:05");
  expect(result.endTime).toBe("10:05");
});

test("makeEmptyFormValues uses provided date instead of today", () => {
  const now = new Date("2025-07-15T12:00:00.000Z");
  const result = makeEmptyFormValues({ now, date: "2025-08-01" });
  expect(result.date).toBe("2025-08-01");
  // Time still derived from now
  expect(result.startTime).toBe("14:00");
  expect(result.endTime).toBe("15:00");
});

test("makeEmptyFormValues midnight edge: end capped to 23:59 and > start", () => {
  // 2025-01-20 23:10 Berlin (CET = UTC+1) → rounded to 23:10, end would be 00:10
  // → capped to 23:59
  const now = new Date("2025-01-20T22:10:00.000Z");
  const result = makeEmptyFormValues({ now });
  expect(result.startTime).toBe("23:10");
  expect(result.endTime).toBe("23:59");
  // Verify end > start (Zod validation requirement)
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  expect(toMin(result.endTime)).toBeGreaterThan(toMin(result.startTime));
});

test("makeEmptyFormValues near 23:00 still fits +60 min", () => {
  // 2025-01-20 22:50 Berlin (CET = UTC+1) → rounded to 22:50, end 23:50 fits
  const now = new Date("2025-01-20T21:50:00.000Z");
  const result = makeEmptyFormValues({ now });
  expect(result.startTime).toBe("22:50");
  expect(result.endTime).toBe("23:50");
});

test("makeEmptyFormValues at 23:58 Berlin does not overflow to next day", () => {
  // 2025-01-20 23:58 Berlin (CET = UTC+1) → rounding would give 24:00
  // Must cap start to 23:58, end to 23:59
  const now = new Date("2025-01-20T22:58:00.000Z");
  const result = makeEmptyFormValues({ now });
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  expect(toMin(result.startTime)).toBeLessThanOrEqual(23 * 60 + 59);
  expect(toMin(result.endTime)).toBeLessThanOrEqual(23 * 60 + 59);
  expect(toMin(result.endTime)).toBeGreaterThan(toMin(result.startTime));
  expect(result.startTime).toBe("23:58");
  expect(result.endTime).toBe("23:59");
});

test("makeEmptyFormValues at 23:59 Berlin does not overflow to next day", () => {
  // 2025-07-15 23:59 Berlin (CEST = UTC+2) → rounding would give 24:00
  // Must cap start to 23:58, end to 23:59
  const now = new Date("2025-07-15T21:59:00.000Z");
  const result = makeEmptyFormValues({ now });
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  expect(toMin(result.startTime)).toBeLessThanOrEqual(23 * 60 + 59);
  expect(toMin(result.endTime)).toBeLessThanOrEqual(23 * 60 + 59);
  expect(toMin(result.endTime)).toBeGreaterThan(toMin(result.startTime));
  expect(result.startTime).toBe("23:58");
  expect(result.endTime).toBe("23:59");
});

// -- roundedNowHHmm --

test("roundedNowHHmm rounds Berlin time to nearest 5 min", () => {
  // 2025-07-15T12:37:00Z = 14:37 Berlin (CEST) → rounded to 14:35
  const now = new Date("2025-07-15T12:37:00.000Z");
  expect(roundedNowHHmm(now)).toBe("14:35");
});

test("roundedNowHHmm caps at 23:58 near midnight", () => {
  // 2025-07-15T21:59:00Z = 23:59 Berlin (CEST) → rounding would give 24:00, capped to 23:58
  const now = new Date("2025-07-15T21:59:00.000Z");
  expect(roundedNowHHmm(now)).toBe("23:58");
});

// -- shiftHHmm --

test("shiftHHmm adds 15 minutes", () => {
  expect(shiftHHmm("10:00", 15)).toBe("10:15");
});

test("shiftHHmm subtracts 15 minutes", () => {
  expect(shiftHHmm("10:00", -15)).toBe("09:45");
});

test("shiftHHmm clamps at 23:59 on overflow", () => {
  expect(shiftHHmm("23:55", 15)).toBe("23:59");
});

test("shiftHHmm clamps at 00:00 on underflow", () => {
  expect(shiftHHmm("00:05", -15)).toBe("00:00");
});
