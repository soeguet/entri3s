import { appError } from "../lib/app-error";
import { indentWidth, parseList, type RawTask } from "./parser";

// Reine Funktion zum Umsortieren eines Tasks INNERHALB einer Liste (Grundlage
// für Drag&Drop). Der verschobene Task nimmt seinen Subtask-Block mit. Lokalisiert
// wird ausschließlich über die exakte ROH-Zeile (Fingerprint), fail-closed bei
// 0 oder >1 Treffern (nie Best-Guess), analog mutate.ts.

// Findet die eindeutige Task-Zeile zu einem Fingerprint. Fail-closed: 0 oder
// >1 Treffer -> TODO_CONFLICT, statt die falsche Zeile zu treffen.
function locate(raw: RawTask[], fingerprint: string): RawTask {
  const matches = raw.filter((r) => r.raw === fingerprint);
  if (matches.length !== 1) {
    throw appError("TODO_CONFLICT", "Aufgabe wurde extern geändert, nicht gespeichert.", false);
  }
  return matches[0];
}

// Bestimmt die contiguous "Subtree"-Zeilen-Range [start, end) eines Task-Blocks:
// Startzeile = Task selbst; der Block schließt ALLE direkt folgenden Zeilen ein,
// deren normalisierte Einrückung GRÖSSER ist als die der Anker-Task-Zeile — also
// Beschreibungs-Zeilen UND verschachtelte Subtasks (samt deren Beschreibungen).
// Er stoppt bei der ersten Zeile mit Einrückung <= Anker, einem Section-Header,
// einer Leerzeile oder am Listenende. So wandert beim Reorder der Task inkl.
// Beschreibung + Subtasks als Ganzes; insertSubtask hängt hinter den Subtree an.
//
// Der raw-Parameter wird hier nicht mehr gebraucht (rein zeilenbasiert), bleibt
// aber für aufrufer-stabile Signatur erhalten — Subtree-Erkennung über Einrückung
// ist robuster als die alte task-only-Logik (erfasst Beschreibungs-Zeilen).
const SECTION_BLOCK_RE = /^#{2,6}\s+/;
export function blockRange(
  lines: string[],
  _raw: RawTask[],
  head: RawTask,
): { start: number; end: number } {
  const start = head.lineIndex;
  const anchorIndent = indentWidth(lines[start]);
  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (line.trim() === "") break;
    if (SECTION_BLOCK_RE.test(line)) break;
    if (indentWidth(line) <= anchorIndent) break;
    end++;
  }
  return { start, end };
}

export function reorderLines(
  content: string,
  movedFingerprint: string,
  targetFingerprint: string,
  before: boolean,
): string {
  if (movedFingerprint === targetFingerprint) return content;

  const parsed = parseList("_", "_", content);
  const moved = locate(parsed.raw, movedFingerprint);
  // target hier nur validieren (fail-closed); relokalisiert wird nach dem
  // Entfernen des Blocks, da sich die Indizes dann verschieben.
  locate(parsed.raw, targetFingerprint);

  const movedBlock = blockRange(parsed.lines, parsed.raw, moved);
  const block = parsed.lines.slice(movedBlock.start, movedBlock.end);
  const rest = [...parsed.lines.slice(0, movedBlock.start), ...parsed.lines.slice(movedBlock.end)];

  // target in der RESTLISTE erneut lokalisieren (fail-closed). Hat der moved-
  // Block den target enthalten, fehlt er jetzt -> TODO_CONFLICT.
  const restParsed = parseList("_", "_", rest.join("\n") + (parsed.trailingNewline ? "\n" : ""));
  const target = locate(restParsed.raw, targetFingerprint);

  let insertAt: number;
  if (before) {
    insertAt = target.lineIndex;
  } else {
    // NACH dem gesamten target-Block einfügen, damit man nicht in dessen
    // Subtasks hineinrutscht.
    insertAt = blockRange(restParsed.lines, restParsed.raw, target).end;
  }

  const out = [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)];
  return out.join("\n") + (parsed.trailingNewline ? "\n" : "");
}
