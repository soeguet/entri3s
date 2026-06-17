import { test, expect } from "bun:test";
import { formatDuration, roundUpToQuarterHour } from "./format";

test("formatDuration covers edge cases", () => {
  expect(formatDuration(0)).toBe("0h");
  expect(formatDuration(30)).toBe("0h 30m");
  expect(formatDuration(60)).toBe("1h");
  expect(formatDuration(90)).toBe("1h 30m");
  expect(formatDuration(120)).toBe("2h");
});

test("roundUpToQuarterHour always rounds up to the next full 15 minutes", () => {
  expect(roundUpToQuarterHour(0)).toBe(0);
  expect(roundUpToQuarterHour(1)).toBe(15);
  expect(roundUpToQuarterHour(15)).toBe(15);
  expect(roundUpToQuarterHour(16)).toBe(30);
  expect(roundUpToQuarterHour(31)).toBe(45);
  expect(roundUpToQuarterHour(60)).toBe(60);
  expect(roundUpToQuarterHour(90)).toBe(90);
});
