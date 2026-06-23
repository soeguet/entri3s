import { test, expect } from "bun:test";
import { applyTaskEdit, renderNewTask } from "./serializer";

test("toggle done flips only the checkbox (doneDate is added by service)", () => {
  const line = "- [ ] Buy milk 📅 2026-06-23 #errand";
  expect(applyTaskEdit(line, { done: true })).toBe("- [x] Buy milk 📅 2026-06-23 #errand");
});

test("explicit doneDate edit appends ✅ date", () => {
  const line = "- [x] Task";
  expect(applyTaskEdit(line, { doneDate: "2026-06-22" })).toBe("- [x] Task ✅ 2026-06-22");
});

test("editing due replaces existing due date in place", () => {
  const line = "- [ ] Task 📅 2026-01-01 #tag";
  expect(applyTaskEdit(line, { due: "2026-12-31" })).toBe("- [ ] Task #tag 📅 2026-12-31");
});

test("removing due (null) strips the token", () => {
  const line = "- [ ] Task 📅 2026-01-01";
  expect(applyTaskEdit(line, { due: null })).toBe("- [ ] Task");
});

test("changing priority replaces existing priority emoji", () => {
  const line = "- [ ] Task 🔼";
  expect(applyTaskEdit(line, { priority: "high" })).toBe("- [ ] Task ⏫");
});

test("priority normal removes any emoji", () => {
  const line = "- [ ] Task 🔺";
  expect(applyTaskEdit(line, { priority: "normal" })).toBe("- [ ] Task");
});

test("editing title keeps trailing metadata", () => {
  const line = "- [ ] Old title 📅 2026-06-23 #tag";
  expect(applyTaskEdit(line, { title: "New title" })).toBe("- [ ] New title 📅 2026-06-23 #tag");
});

test("setting tags appends them at the end of the body", () => {
  const line = "- [ ] Task 📅 2026-06-30";
  expect(applyTaskEdit(line, { tags: ["work", "urgent"] })).toBe(
    "- [ ] Task 📅 2026-06-30 #work #urgent",
  );
});

test("setting tags replaces existing tags (may move them to the end)", () => {
  const line = "- [ ] Task #old #stale 📅 2026-06-30";
  expect(applyTaskEdit(line, { tags: ["new"] })).toBe("- [ ] Task 📅 2026-06-30 #new");
});

test("empty tags array strips all tags", () => {
  const line = "- [ ] Task #a #b 📅 2026-06-30";
  expect(applyTaskEdit(line, { tags: [] })).toBe("- [ ] Task 📅 2026-06-30");
});

test("round-trip stays byte-exact when tags are not in the edit", () => {
  const line = "- [ ] Task #keep 📅 2026-06-30";
  expect(applyTaskEdit(line, {})).toBe(line);
  expect(applyTaskEdit(line, { title: "Task" })).toBe(line);
});

test("renderNewTask builds checkbox, tags, priority, due in defined order", () => {
  expect(
    renderNewTask({
      listId: "L",
      title: "Write report",
      priority: "high",
      due: "2026-06-30",
      tags: ["work"],
    }),
  ).toBe("- [ ] Write report #work ⏫ 📅 2026-06-30");
});

test("renderNewTask minimal", () => {
  expect(renderNewTask({ listId: "L", title: "Plain" })).toBe("- [ ] Plain");
});
