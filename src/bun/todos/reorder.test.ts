import { test, expect } from "bun:test";
import { reorderLines } from "./reorder";

// fp = exakte Roh-Zeile eines Tasks (Fingerprint), so wie reorderLines lokalisiert.

test("moves a task before the target within a list", () => {
  const content = "- [ ] a\n- [ ] b\n- [ ] c\n";
  const out = reorderLines(content, "- [ ] c", "- [ ] a", true);
  expect(out).toBe("- [ ] c\n- [ ] a\n- [ ] b\n");
});

test("moves a task after the target within a list", () => {
  const content = "- [ ] a\n- [ ] b\n- [ ] c\n";
  const out = reorderLines(content, "- [ ] a", "- [ ] b", false);
  expect(out).toBe("- [ ] b\n- [ ] a\n- [ ] c\n");
});

test("moves a parent together with its subtasks (block stays contiguous)", () => {
  const content = "- [ ] a\n- [ ] parent\n  - [ ] s1\n  - [ ] s2\n- [ ] c\n";
  // parent vor a verschieben -> ganzer Block parent+s1+s2 wandert, Reihenfolge erhalten.
  const out = reorderLines(content, "- [ ] parent", "- [ ] a", true);
  expect(out).toBe("- [ ] parent\n  - [ ] s1\n  - [ ] s2\n- [ ] a\n- [ ] c\n");
});

test("after-insert lands behind the full target block (not inside its subtasks)", () => {
  const content = "- [ ] a\n- [ ] parent\n  - [ ] s1\n- [ ] c\n";
  // a NACH parent -> hinter dessen Subtask-Block, nicht zwischen parent und s1.
  const out = reorderLines(content, "- [ ] a", "- [ ] parent", false);
  expect(out).toBe("- [ ] parent\n  - [ ] s1\n- [ ] a\n- [ ] c\n");
});

test("block stops at a sibling task (same depth)", () => {
  const content = "- [ ] p1\n  - [ ] s1\n- [ ] p2\n";
  // p1-Block = p1+s1, p2 bleibt eigenständig. p1 hinter p2.
  const out = reorderLines(content, "- [ ] p1", "- [ ] p2", false);
  expect(out).toBe("- [ ] p2\n- [ ] p1\n  - [ ] s1\n");
});

test("block stops at a non-task line (blank line breaks the block)", () => {
  const content = "- [ ] p\n\n  - [ ] orphan\n- [ ] t\n";
  // Leerzeile bricht den Block: nur p wandert, die getrennte Subtask-Zeile bleibt.
  const out = reorderLines(content, "- [ ] p", "- [ ] t", false);
  expect(out).toBe("\n  - [ ] orphan\n- [ ] t\n- [ ] p\n");
});

test("moves a task with description AND subtasks as one complete block", () => {
  const content =
    "- [ ] a\n" +
    "- [ ] parent\n" +
    "  parent note\n" +
    "  - [ ] s1\n" +
    "    s1 note\n" +
    "- [ ] c\n";
  // parent vor a -> der ganze Subtree (Beschreibung + Subtask + dessen Beschreibung) wandert.
  const out = reorderLines(content, "- [ ] parent", "- [ ] a", true);
  expect(out).toBe(
    "- [ ] parent\n" +
      "  parent note\n" +
      "  - [ ] s1\n" +
      "    s1 note\n" +
      "- [ ] a\n" +
      "- [ ] c\n",
  );
});

test("after-insert lands behind a target's description block", () => {
  const content = "- [ ] a\n- [ ] parent\n  parent note\n- [ ] c\n";
  // a NACH parent -> hinter die Beschreibungs-Zeile, nicht zwischen parent und Notiz.
  const out = reorderLines(content, "- [ ] a", "- [ ] parent", false);
  expect(out).toBe("- [ ] parent\n  parent note\n- [ ] a\n- [ ] c\n");
});

test("no-op when moved equals target", () => {
  const content = "- [ ] a\n- [ ] b\n";
  expect(reorderLines(content, "- [ ] a", "- [ ] a", true)).toBe(content);
});

test("fail-closed on duplicate moved line", () => {
  const content = "- [ ] dup\n- [ ] dup\n- [ ] t\n";
  expect(() => reorderLines(content, "- [ ] dup", "- [ ] t", true)).toThrow();
});

test("fail-closed on duplicate target line", () => {
  const content = "- [ ] m\n- [ ] dup\n- [ ] dup\n";
  expect(() => reorderLines(content, "- [ ] m", "- [ ] dup", true)).toThrow();
});

test("fail-closed when moved fingerprint not found", () => {
  const content = "- [ ] a\n- [ ] b\n";
  expect(() => reorderLines(content, "- [ ] nope", "- [ ] a", true)).toThrow();
});

test("fail-closed when target fingerprint not found", () => {
  const content = "- [ ] a\n- [ ] b\n";
  expect(() => reorderLines(content, "- [ ] a", "- [ ] nope", true)).toThrow();
});

test("preserves absence of trailing newline", () => {
  const content = "- [ ] a\n- [ ] b";
  const out = reorderLines(content, "- [ ] b", "- [ ] a", true);
  expect(out).toBe("- [ ] b\n- [ ] a");
});

test("leaves unrelated lines byte-exact (headings, blanks, metadata)", () => {
  const content = "# Title\n\n## Sec\n- [ ] a 📅 2026-06-30\n- [ ] b #tag\n\n## Other\n- [ ] c\n";
  const out = reorderLines(content, "- [ ] b #tag", "- [ ] a 📅 2026-06-30", true);
  expect(out).toBe("# Title\n\n## Sec\n- [ ] b #tag\n- [ ] a 📅 2026-06-30\n\n## Other\n- [ ] c\n");
});
