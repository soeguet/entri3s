import { appError } from "../lib/app-error";
import { parseList, type RawTask } from "./parser";

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

// Bestimmt die contiguous Zeilen-Range [start, end) eines Task-Blocks: Startzeile
// = Task selbst; der Block läuft über alle direkt folgenden Zeilen, die TASK-
// Zeilen mit größerer depth sind (Subtasks). Er stoppt bei der ersten Zeile, die
// KEINE tiefere Task-Zeile ist (Sibling-Task, Sektion, Leerzeile, Nicht-Task)
// oder am Listenende. Nutzt parsed.raw, um Folgezeilen als tiefere Tasks zu
// erkennen — Nicht-Task-Zeilen tauchen dort nicht auf und brechen den Block.
export function blockRange(raw: RawTask[], head: RawTask): { start: number; end: number } {
  const start = head.lineIndex;
  let end = start + 1;
  // raw ist nach lineIndex sortiert (Parse-Reihenfolge). Folge-Tasks sind nur
  // Subtasks, wenn sie LÜCKENLOS (jede Zeile ein tieferer Task) anschließen.
  const headPos = raw.findIndex((r) => r.lineIndex === start);
  for (let i = headPos + 1; i < raw.length; i++) {
    const next = raw[i];
    // Lücke = dazwischen lag eine Nicht-Task-Zeile -> Block endet.
    if (next.lineIndex !== end) break;
    if (next.task.depth <= head.task.depth) break;
    end = next.lineIndex + 1;
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

  const movedBlock = blockRange(parsed.raw, moved);
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
    insertAt = blockRange(restParsed.raw, target).end;
  }

  const out = [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)];
  return out.join("\n") + (parsed.trailingNewline ? "\n" : "");
}
