import { test, expect } from "bun:test";
import { parseList } from "./parser";
import { completeOpenDescendants } from "./cascade";

const TODAY = "2026-06-25";

// idx des Parents über seinen Titel finden (lineIndex der Task-Zeile).
function idxOf(parsed: ReturnType<typeof parseList>, title: string): number {
  return parsed.raw.find((r) => r.task.title === title)!.lineIndex;
}

test("completeOpenDescendants checks all open descendants, skips recurring + already-done", () => {
  const content =
    "- [ ] parent\n" +
    "  - [ ] child\n" +
    "    note line\n" +
    "    - [ ] grandchild\n" +
    "  - [x] done child ✅ 2026-06-20\n" +
    "  - [ ] recurring 🔁 every day\n";
  const parsed = parseList("L", "L", content);
  const out = completeOpenDescendants(parsed.lines, parsed, idxOf(parsed, "parent"), TODAY);

  expect(out[1]).toBe("  - [x] child ✅ 2026-06-25");
  // Description-Zeile unverändert.
  expect(out[2]).toBe("    note line");
  expect(out[3]).toBe("    - [x] grandchild ✅ 2026-06-25");
  // Bereits erledigtes Kind unverändert (kein doppeltes ✅).
  expect(out[4]).toBe("  - [x] done child ✅ 2026-06-20");
  // recurring Kind unverändert offen.
  expect(out[5]).toBe("  - [ ] recurring 🔁 every day");
  // Parent-Zeile selbst wird hier NICHT angefasst (das macht applyUpdate).
  expect(out[0]).toBe("- [ ] parent");
});

test("completeOpenDescendants returns a copy and leaves siblings outside the block alone", () => {
  const content = "- [ ] parent\n  - [ ] child\n- [ ] sibling\n";
  const parsed = parseList("L", "L", content);
  const out = completeOpenDescendants(parsed.lines, parsed, idxOf(parsed, "parent"), TODAY);

  expect(out).not.toBe(parsed.lines);
  expect(out[1]).toBe("  - [x] child ✅ 2026-06-25");
  // Geschwister außerhalb des Subtree-Blocks bleiben unberührt.
  expect(out[2]).toBe("- [ ] sibling");
});
