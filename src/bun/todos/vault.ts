import { closeSync, fsyncSync, openSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import { appError } from "../lib/app-error";

// Einzige node:fs-Stelle für das Todo-Modul (FS-Gateway). Kapselt Listen-Listing,
// Lesen (mit Hash+mtime), atomares Schreiben, Watcher und Pfad-Sanitization.

export interface ReadResult {
  content: string;
  mtimeMs: number;
  hash: string;
}

export function hashContent(content: string): string {
  // Bun.hash ist schnell und für self-write-suppression/Concurrency-Check
  // ausreichend (keine kryptografische Anforderung).
  return String(Bun.hash(content));
}

// Whitelist-Sanitization für Listennamen -> Dateiname. Verhindert Pfad-Traversal
// (kein "../", keine Separatoren). Wirft TODO_CONFLICT-fremd bewusst INVALID_NAME.
export function sanitizeListName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw appError("INVALID_NAME", "Listenname darf nicht leer sein.", false);
  // `~` ist der reservierte Sub-Listen-Delimiter (z.B. "Arbeit~ProjektA").
  // Bisher war `~` verboten -> null Migrations-/Kollisionsrisiko mit Altdaten.
  // `~` ist weder Pfad-Separator noch `.`, daher kein Traversal/Hidden-File.
  // Das abschliessende `-` ist literal (kein Range), `~` steht direkt davor.
  if (!/^[\p{L}\p{N} _~-]+$/u.test(trimmed)) {
    throw appError(
      "INVALID_NAME",
      "Listenname darf nur Buchstaben, Zahlen, Leerzeichen, _, ~ und - enthalten.",
      false,
    );
  }
  // basename als zweite Verteidigungslinie gegen Separatoren/Traversal.
  if (basename(trimmed) !== trimmed) {
    throw appError("INVALID_NAME", "Ungültiger Listenname.", false);
  }
  return trimmed;
}

export function listMd(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name.slice(0, -3));
}

export function fileForList(dir: string, listName: string): string {
  return join(dir, `${sanitizeListName(listName)}.md`);
}

export async function read(file: string): Promise<ReadResult> {
  const content = await readFile(file, "utf8");
  const st = await stat(file);
  return { content, mtimeMs: st.mtimeMs, hash: hashContent(content) };
}

// Atomares Schreiben: temp im selben Ordner -> fsync(tempFd) -> rename() über
// Ziel. Best-effort dirFd-fsync (auf Windows kein O_DIRECTORY -> skip).
//
// BEWUSSTER TRADE-OFF (Lost-Update-Restrisiko): rename() überschreibt einen
// Fremd-Write, der im Fenster zwischen unserem Lesen und diesem rename passiert.
// Kein OS-Lock, weil entries ein "braver Mitbewohner" des Vaults sein soll
// (Obsidian/Sync schreiben dieselben Dateien). Der detect-before-write-Check in
// mutate.ts (Hash + Fingerprint) verkleinert das Fenster und schließt fail-closed.
export function writeAtomic(file: string, content: string): string {
  const tmp = `${file}.entries-${process.pid}-${Date.now()}.tmp`;
  const fd = openSync(tmp, "w");
  try {
    writeFileSync(fd, content);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, file);
  if (process.platform !== "win32") {
    try {
      const dirFd = openSync(join(file, ".."), "r");
      try {
        fsyncSync(dirFd);
      } finally {
        closeSync(dirFd);
      }
    } catch {
      // Verzeichnis-fsync ist best-effort; Fehler hier sind nicht fatal.
    }
  }
  return hashContent(content);
}

export function watch(dir: string, onChange: (path: string) => void): FSWatcher {
  return chokidar
    .watch(dir, {
      ignoreInitial: true,
      depth: 0,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 50 },
    })
    .on("all", (_event, path) => {
      if (path.endsWith(".md")) onChange(path);
    });
}
