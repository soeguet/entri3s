import { test, expect, beforeEach } from "bun:test";
import type { Settings } from "../../shared/types";
import { createTestDb } from "./test-helper";
import { createSettingsRepository } from "./settings";

let repo: ReturnType<typeof createSettingsRepository>;

beforeEach(() => {
  repo = createSettingsRepository(createTestDb());
});

function fullSettings(reminderTime: string): Settings {
  return {
    gitlabUrl: "",
    syncIntervalSec: 300,
    todoFolder: "",
    todoRemindersEnabled: true,
    reminderTime,
  };
}

test("reminderTime defaults to 09:00 when the key is missing", () => {
  expect(repo.getAll().reminderTime).toBe("09:00");
});

test("reminderTime falls back to 09:00 when the stored value is malformed", () => {
  repo.set("reminderTime", "25:99");
  expect(repo.getAll().reminderTime).toBe("09:00");
});

test("save normalizes an invalid reminderTime to 09:00", () => {
  repo.save(fullSettings("nonsense"));
  expect(repo.get("reminderTime")).toBe("09:00");
  expect(repo.getAll().reminderTime).toBe("09:00");
});

test("reminderTime round-trips a valid value through save/getAll", () => {
  repo.save(fullSettings("07:45"));
  expect(repo.getAll().reminderTime).toBe("07:45");
});

test("reminderTime accepts boundary values 00:00 and 23:59", () => {
  repo.save(fullSettings("00:00"));
  expect(repo.getAll().reminderTime).toBe("00:00");
  repo.save(fullSettings("23:59"));
  expect(repo.getAll().reminderTime).toBe("23:59");
});
