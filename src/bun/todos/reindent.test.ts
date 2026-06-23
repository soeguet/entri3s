import { test, expect } from "bun:test";
import { parseList } from "./parser";
import { reindentLines } from "./reindent";

// Roh-Zeile eines Tasks per Titel-Substring finden (Test-Helper). Der echte
// Aufrufer kennt den Fingerprint aus dem frischen Parse; hier reicht die Zeile.
function fp(content: string, titleSubstr: string): string {
  const hit = parseList("_", "_", content).raw.find((r) => r.raw.includes(titleSubstr));
  if (!hit) throw new Error(`Task mit "${titleSubstr}" nicht gefunden`);
  return hit.raw;
}

test("indent rückt Task + Beschreibung + Subtask um 2 Spaces ein", () => {
  const content = "- [ ] parent\n- [ ] child\n  beschreibung\n  - [ ] enkel\n";
  const out = reindentLines(content, fp(content, "child"), "indent");
  expect(out).toBe("- [ ] parent\n  - [ ] child\n    beschreibung\n    - [ ] enkel\n");
});

test("outdent rückt Task + Subtree um 2 Spaces aus", () => {
  const content = "- [ ] parent\n  - [ ] child\n    beschreibung\n    - [ ] enkel\n";
  const out = reindentLines(content, fp(content, "child"), "outdent");
  expect(out).toBe("- [ ] parent\n- [ ] child\n  beschreibung\n  - [ ] enkel\n");
});

test("Round-Trip: indent danach outdent ergibt exakt das Original", () => {
  const content = "- [ ] parent\n- [ ] child\n  note\n  - [ ] enkel\n";
  const indented = reindentLines(content, fp(content, "child"), "indent");
  const back = reindentLines(indented, fp(indented, "child"), "outdent");
  expect(back).toBe(content);
});

test("Round-Trip ohne trailing newline bleibt ohne trailing newline", () => {
  const content = "- [ ] parent\n- [ ] child";
  const indented = reindentLines(content, fp(content, "child"), "indent");
  expect(indented.endsWith("\n")).toBe(false);
  const back = reindentLines(indented, fp(indented, "child"), "outdent");
  expect(back).toBe(content);
});

test("outdent eines Tiefe-0-Tasks wirft", () => {
  const content = "- [ ] top\n- [ ] zweiter\n";
  expect(() => reindentLines(content, fp(content, "top"), "outdent")).toThrow();
});

test("indent des ersten Tasks wirft (kein Vorgänger)", () => {
  const content = "- [ ] erster\n- [ ] zweiter\n";
  expect(() => reindentLines(content, fp(content, "erster"), "indent")).toThrow();
});

test("indent wirft, wenn der vorangehende Task flacher ist", () => {
  // anchor "child" ist bereits Tiefe 1; Vorgänger "parent" ist Tiefe 0 (flacher)
  // -> Sprung auf Tiefe 2 unter einem Tiefe-0-Parent ist ungültig.
  const content = "- [ ] parent\n  - [ ] child\n";
  expect(() => reindentLines(content, fp(content, "child"), "indent")).toThrow();
});

test("fail-closed bei doppeltem Fingerprint", () => {
  const content = "- [ ] dup\n- [ ] dup\n";
  expect(() => reindentLines(content, "- [ ] dup", "indent")).toThrow();
});

test("fail-closed bei fehlendem Fingerprint", () => {
  const content = "- [ ] a\n- [ ] b\n";
  expect(() => reindentLines(content, "- [ ] gibt-es-nicht", "outdent")).toThrow();
});
