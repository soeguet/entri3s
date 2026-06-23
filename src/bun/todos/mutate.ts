import { appError } from "../lib/app-error";
import { parseList, type ParsedList } from "./parser";
import { read, writeAtomic } from "./vault";

// Read-modify-write-Helper: frisch lesen -> parsen -> Ziel-Task per Roh-Zeilen-
// FINGERPRINT relokalisieren -> Zeilen mutieren -> writeAtomic. FAIL-CLOSED bei
// 0 oder >1 Treffern (nie Best-Guess), siehe Spec Concurrency-Modell.

export type LineMutator = (parsed: ParsedList, lineIndex: number) => string[];

// Registry der zuletzt SELBST geschriebenen Hashes pro Datei (self-write-
// suppression, HASH-basiert, NICHT zeitbasiert). index.ts fragt sie im Watcher ab.
const selfWriteHashes = new Map<string, string>();

export function rememberSelfWrite(file: string, hash: string): void {
  selfWriteHashes.set(file, hash);
}

export function isSelfWrite(file: string, currentHash: string): boolean {
  return selfWriteHashes.get(file) === currentHash;
}

// Lokalisiert die Zeile eines Tasks über seine exakte Roh-Zeile (Fingerprint).
// DUPLIKAT-RISIKO: zwei byte-gleiche Task-Zeilen sind nicht unterscheidbar ->
// >1 Treffer -> TODO_CONFLICT (fail-closed), statt die falsche zu treffen.
function locateLine(parsed: ParsedList, fingerprint: string): number {
  const matches = parsed.raw.filter((r) => r.raw === fingerprint);
  if (matches.length !== 1) {
    throw appError("TODO_CONFLICT", "Aufgabe wurde extern geändert, nicht gespeichert.", false);
  }
  return matches[0].lineIndex;
}

function joinLines(lines: string[], trailingNewline: boolean): string {
  return lines.join("\n") + (trailingNewline ? "\n" : "");
}

// Mutiert eine Datei anhand des Roh-Zeilen-Fingerprints des Ziel-Tasks. expected
// Hash (vom vorherigen Lesen) ist optionaler Vorab-Check; der eigentliche Schutz
// ist die Fingerprint-Relokalisierung. mutator gibt die NEUEN Zeilen zurück.
export async function mutateFile(
  listId: string,
  file: string,
  fingerprint: string,
  mutator: LineMutator,
): Promise<void> {
  const fresh = await read(file);
  const parsed = parseList(listId, listId, fresh.content);
  const lineIndex = locateLine(parsed, fingerprint);
  const newLines = mutator(parsed, lineIndex);
  const hash = writeAtomic(file, joinLines(newLines, parsed.trailingNewline));
  rememberSelfWrite(file, hash);
}

// Schreibt frei berechneten Inhalt (z.B. createList, append) und merkt den Hash.
export function writeContent(file: string, content: string): void {
  const hash = writeAtomic(file, content);
  rememberSelfWrite(file, hash);
}
