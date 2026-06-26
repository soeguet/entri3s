import { appError } from "../lib/app-error";
import { parseList, type RawTask } from "./parser";
import { blockRange } from "./reorder";

// Reine Funktion zum Ändern der Einrückung eines Tasks (inkl. Subtree).
// Lokalisierung über exakte ROH-Zeile (Fingerprint), fail-closed bei
// 0 oder >1 Treffern, analog reorder.ts.

function locate(raw: RawTask[], fingerprint: string): RawTask {
  const matches = raw.filter((r) => r.raw === fingerprint);
  if (matches.length !== 1) {
    throw appError("TODO_CONFLICT", "Aufgabe wurde extern geändert, nicht gespeichert.", false);
  }
  return matches[0];
}

export function indentLines(
  content: string,
  fingerprint: string,
  direction: "indent" | "outdent",
): string {
  const parsed = parseList("_", "_", content);
  const located = locate(parsed.raw, fingerprint);
  const { start, end } = blockRange(parsed.lines, parsed.raw, located);
  const lines = [...parsed.lines];

  if (direction === "indent") {
    // Guard: vorheriges Geschwister auf gleicher Tiefe nötig
    const idx = parsed.raw.indexOf(located);
    const hasSibling = parsed.raw.slice(0, idx).some((r) => r.task.depth === located.task.depth);
    if (!hasSibling) {
      throw appError("TODO_CONFLICT", "Kann nicht weiter einrücken.", false);
    }
    for (let i = start; i < end; i++) {
      lines[i] = "  " + lines[i];
    }
  } else {
    // Guard: bereits auf oberster Ebene
    if (located.task.depth === 0) {
      throw appError("TODO_CONFLICT", "Kann nicht weiter ausrücken.", false);
    }
    for (let i = start; i < end; i++) {
      lines[i] = lines[i].replace(/^ {2}/, "");
    }
  }

  return lines.join("\n") + (parsed.trailingNewline ? "\n" : "");
}
