import { test, expect } from "bun:test";
import { parseList } from "./parser";
import { applyTaskEdit } from "./serializer";

// ROUND-TRIP-PFLICHT: parse->serialize einer UNVERÄNDERTEN Task-Zeile muss
// byte-genau das Original ergeben (applyTaskEdit mit leerem Edit ist identity).

const SAMPLE = `---
tags: [project]
---

# Inbox

Some intro text, not a task.

## Today
- [ ] Buy milk 📅 2026-06-23 #errand
- [x] Ship release ✅ 2026-06-20 🔼 ➕ 2026-06-01
- [ ] Recurring standup 🔁 every day 📅 2026-06-22
- [ ] Weird emoji task 🦄 kept verbatim 🆔 abc123 ⛔ def456

## Later
	- [ ] Indented subtask with tab
- [ ] Unknown rule 🔁 every 3 fortnights 📅 2026-07-01
`;

test("round-trip: every task line survives parse->serialize byte-exact", () => {
  const parsed = parseList("Inbox", "Inbox", SAMPLE);
  for (const r of parsed.raw) {
    expect(applyTaskEdit(r.raw, {})).toBe(r.raw);
  }
});

test("round-trip: full file rebuilds byte-exact from lines", () => {
  const parsed = parseList("Inbox", "Inbox", SAMPLE);
  const rebuilt = parsed.lines.join("\n") + (parsed.trailingNewline ? "\n" : "");
  expect(rebuilt).toBe(SAMPLE);
});

test("round-trip: content without trailing newline is preserved", () => {
  const noNl = "- [ ] task one\n- [x] task two ✅ 2026-06-01";
  const parsed = parseList("L", "L", noNl);
  expect(parsed.trailingNewline).toBe(false);
  expect(parsed.lines.join("\n")).toBe(noNl);
});

test("parser extracts fields and ignores non-task lines", () => {
  const parsed = parseList("Inbox", "Inbox", SAMPLE);
  const titles = parsed.list.tasks.map((t) => t.title);
  expect(titles).toContain("Buy milk");
  expect(parsed.list.sections).toEqual(["Today", "Later"]);

  const milk = parsed.list.tasks.find((t) => t.title === "Buy milk")!;
  expect(milk.due).toBe("2026-06-23");
  expect(milk.tags).toEqual(["errand"]);
  expect(milk.section).toBe("Today");

  const ship = parsed.list.tasks.find((t) => t.title === "Ship release")!;
  expect(ship.done).toBe(true);
  expect(ship.doneDate).toBe("2026-06-20");
  expect(ship.priority).toBe("medium");
  expect(ship.created).toBe("2026-06-01");
});

test("known recurrence is editable, unknown is read-only", () => {
  const parsed = parseList("Inbox", "Inbox", SAMPLE);
  const daily = parsed.list.tasks.find((t) => t.recurrence === "every day")!;
  expect(daily.recurrenceEditableInApp).toBe(true);
  const weird = parsed.list.tasks.find((t) => t.recurrence === "every 3 fortnights")!;
  expect(weird.recurrenceEditableInApp).toBe(false);
});
