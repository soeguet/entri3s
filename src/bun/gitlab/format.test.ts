import { test, expect } from "bun:test";
import { formatDuration } from "./format";

test("formatDuration covers edge cases", () => {
  expect(formatDuration(0)).toBe("0h");
  expect(formatDuration(30)).toBe("0h 30m");
  expect(formatDuration(60)).toBe("1h");
  expect(formatDuration(90)).toBe("1h 30m");
  expect(formatDuration(120)).toBe("2h");
});
