import { test, expect } from "bun:test";
import { indentLines } from "./indent";
import { parseList } from "./parser";

// fp = exakte Roh-Zeile eines Tasks (Fingerprint), so wie indentLines lokalisiert.
function fp(content: string, i: number): string {
  return parseList("_", "_", content).raw[i].raw;
}

test("indents a task with a preceding sibling (+2 spaces)", () => {
  const content = "- [ ] a\n- [ ] b\n";
  const out = indentLines(content, fp(content, 1), "indent");
  expect(out).toBe("- [ ] a\n  - [ ] b\n");
});

test("indents a task together with its subtree (description + nested subtasks)", () => {
  const content =
    "- [ ] a\n" + "- [ ] b\n" + "  b note\n" + "  - [ ] s1\n" + "    s1 note\n" + "- [ ] c\n";
  // b einrücken -> der ganze Subtree (Beschreibung + Subtask + dessen Beschreibung) +2 Spaces.
  const out = indentLines(content, fp(content, 1), "indent");
  expect(out).toBe(
    "- [ ] a\n" +
      "  - [ ] b\n" +
      "    b note\n" +
      "    - [ ] s1\n" +
      "      s1 note\n" +
      "- [ ] c\n",
  );
});

test("indent guard: throws without a preceding sibling at the same depth", () => {
  const content = "- [ ] a\n- [ ] b\n";
  // a ist der erste Task auf Tiefe 0 -> kein vorheriges Geschwister.
  expect(() => indentLines(content, fp(content, 0), "indent")).toThrow();
});

test("outdents a task at depth>0 (-2 spaces)", () => {
  const content = "- [ ] a\n  - [ ] b\n";
  const out = indentLines(content, fp(content, 1), "outdent");
  expect(out).toBe("- [ ] a\n- [ ] b\n");
});

test("outdents a task together with its subtree", () => {
  const content = "- [ ] a\n" + "  - [ ] b\n" + "    b note\n" + "    - [ ] s1\n" + "- [ ] c\n";
  const out = indentLines(content, fp(content, 1), "outdent");
  expect(out).toBe("- [ ] a\n" + "- [ ] b\n" + "  b note\n" + "  - [ ] s1\n" + "- [ ] c\n");
});

test("outdent guard: throws when already at depth 0", () => {
  const content = "- [ ] a\n- [ ] b\n";
  expect(() => indentLines(content, fp(content, 0), "outdent")).toThrow();
});

test("fail-closed when fingerprint not found", () => {
  const content = "- [ ] a\n- [ ] b\n";
  expect(() => indentLines(content, "- [ ] nope", "indent")).toThrow();
});

test("fail-closed on duplicate fingerprint (>1 match)", () => {
  const content = "- [ ] dup\n- [ ] dup\n";
  expect(() => indentLines(content, "- [ ] dup", "indent")).toThrow();
});

test("preserves absence of trailing newline", () => {
  const content = "- [ ] a\n- [ ] b";
  const out = indentLines(content, fp(content, 1), "indent");
  expect(out).toBe("- [ ] a\n  - [ ] b");
});
