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

// ── Description (mehrzeilige Notiz) ──────────────────────────────────────────

test("description: single line, dedented, with correct range", () => {
  const md = "- [ ] task\n  one line note\n- [ ] other\n";
  const parsed = parseList("L", "L", md);
  const t = parsed.list.tasks.find((x) => x.title === "task")!;
  expect(t.description).toBe("one line note");
  const r = parsed.raw.find((x) => x.task.id === t.id)!;
  expect(r.descRange).toEqual({ start: 1, end: 2 });
});

test("description: multiple lines are joined with \\n and dedented", () => {
  const md = "- [ ] task\n  first\n  second\n  third\n";
  const parsed = parseList("L", "L", md);
  const t = parsed.list.tasks.find((x) => x.title === "task")!;
  expect(t.description).toBe("first\nsecond\nthird");
  const r = parsed.raw.find((x) => x.task.id === t.id)!;
  expect(r.descRange).toEqual({ start: 1, end: 4 });
});

test("description: null when no following indented lines; range is insert point", () => {
  const md = "- [ ] task\n- [ ] other\n";
  const parsed = parseList("L", "L", md);
  const t = parsed.list.tasks.find((x) => x.title === "task")!;
  expect(t.description).toBeNull();
  const r = parsed.raw.find((x) => x.task.id === t.id)!;
  expect(r.descRange).toEqual({ start: 1, end: 1 });
});

test("description: a subtask directly below the task yields empty description", () => {
  const md = "- [ ] task\n  - [ ] sub\n";
  const parsed = parseList("L", "L", md);
  const t = parsed.list.tasks.find((x) => x.title === "task")!;
  expect(t.description).toBeNull();
  const r = parsed.raw.find((x) => x.task.id === t.id)!;
  expect(r.descRange).toEqual({ start: 1, end: 1 });
});

test("description: a blank line ends the description block", () => {
  const md = "- [ ] task\n  note line\n\n  not part of it\n";
  const parsed = parseList("L", "L", md);
  const t = parsed.list.tasks.find((x) => x.title === "task")!;
  expect(t.description).toBe("note line");
  const r = parsed.raw.find((x) => x.task.id === t.id)!;
  expect(r.descRange).toEqual({ start: 1, end: 2 });
});

test("description: a less/equally indented line ends the block", () => {
  const md = "- [ ] task\n  indented note\nflush text\n";
  const parsed = parseList("L", "L", md);
  const t = parsed.list.tasks.find((x) => x.title === "task")!;
  expect(t.description).toBe("indented note");
});

test("round-trip: frontmatter + task + description + subtask + subtask-description", () => {
  const md =
    "---\ntags: [x]\n---\n\n## Sec\n" +
    "- [ ] parent 📅 2026-06-30\n" +
    "  parent note line 1\n" +
    "  parent note line 2\n" +
    "  - [ ] child\n" +
    "    child note\n";
  const parsed = parseList("L", "L", md);
  // Beschreibungen korrekt erkannt.
  const parent = parsed.list.tasks.find((x) => x.title === "parent")!;
  const child = parsed.list.tasks.find((x) => x.title === "child")!;
  expect(parent.description).toBe("parent note line 1\nparent note line 2");
  expect(child.description).toBe("child note");
  // Unveränderte Serialisierung ist byte-genau.
  const rebuilt = parsed.lines.join("\n") + (parsed.trailingNewline ? "\n" : "");
  expect(rebuilt).toBe(md);
});
