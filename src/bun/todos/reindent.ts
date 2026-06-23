import { appError } from "../lib/app-error";
import { indentWidth, parseList, type RawTask } from "./parser";
import { blockRange } from "./reorder";

// Reine Funktion zum Ein-/Ausrücken eines Tasks um EINE Ebene (2 Spaces). Der
// gesamte Subtree (Beschreibung + verschachtelte Subtasks) wandert über
// blockRange als zusammenhängender Block mit. Lokalisiert wird ausschließlich
// über die exakte ROH-Zeile (Fingerprint), fail-closed bei 0 oder >1 Treffern
// (nie Best-Guess), analog reorder.ts/mutate.ts. Round-Trip ist byte-genau.

export type ReindentDirection = "indent" | "outdent";

// Findet die eindeutige Task-Zeile zu einem Fingerprint. Fail-closed: 0 oder
// >1 Treffer -> TODO_CONFLICT, statt die falsche Zeile zu treffen.
function locate(raw: RawTask[], fingerprint: string): RawTask {
  const matches = raw.filter((r) => r.raw === fingerprint);
  if (matches.length !== 1) {
    throw appError("TODO_CONFLICT", "Aufgabe wurde extern geändert, nicht gespeichert.", false);
  }
  return matches[0];
}

// Ungültige Reindent-Operation (Tiefe-0-Outdent, kein/zu flacher Vorgänger beim
// Indent, Fremd-Einrückung). Fail-closed statt Korruption — das Frontend gated
// die Buttons, dies ist nur das Sicherheitsnetz.
function invalid(): never {
  throw appError("TODO_REINDENT", "Aufgabe kann nicht ein-/ausgerückt werden.", false);
}

export function reindentLines(
  content: string,
  fingerprint: string,
  direction: ReindentDirection,
): string {
  const parsed = parseList("_", "_", content);
  const anchor = locate(parsed.raw, fingerprint);
  const block = blockRange(parsed.lines, parsed.raw, anchor);
  const blockLines = parsed.lines.slice(block.start, block.end);

  const out = [...parsed.lines];
  if (direction === "outdent") {
    // Anker muss Tiefe >= 1 haben (mind. 2 führende Spaces). JEDE Block-Zeile
    // muss mit >= 2 Spaces beginnen — sonst (z.B. Tab-/Fremd-Einrückung) nicht
    // korrumpieren, sondern fail-closed abbrechen.
    if (indentWidth(parsed.lines[block.start]) < 2) invalid();
    for (const line of blockLines) {
      if (!line.startsWith("  ")) invalid();
    }
    for (let i = block.start; i < block.end; i++) {
      out[i] = out[i].slice(2);
    }
  } else {
    // Es muss eine unmittelbar vorangehende Task-Zeile geben (raw-Eintrag mit
    // lineIndex < block.start). Ihre Einrückung muss >= der Anker-Einrückung
    // sein, sonst wäre der Sprung ungültig (man würde tiefer einrücken als der
    // potenzielle Parent).
    const prev = parsed.raw
      .filter((r) => r.lineIndex < block.start)
      .reduce<RawTask | null>(
        (best, r) => (!best || r.lineIndex > best.lineIndex ? r : best),
        null,
      );
    if (!prev) invalid();
    if (indentWidth(parsed.lines[prev.lineIndex]) < indentWidth(parsed.lines[block.start])) {
      invalid();
    }
    for (let i = block.start; i < block.end; i++) {
      out[i] = "  " + out[i];
    }
  }

  return out.join("\n") + (parsed.trailingNewline ? "\n" : "");
}
