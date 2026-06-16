import { Database } from "bun:sqlite";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Öffnet (oder erstellt) die SQLite-Datenbank im dataDir, aktiviert WAL und
 * Foreign Keys und führt ausstehende Migrationen aus.
 */
export function openDatabase(dataDir: string): Database {
  mkdirSync(dataDir, { recursive: true });
  const db = new Database(join(dataDir, "entries.db"), { create: true });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  runMigrations(db);
  return db;
}

/**
 * Führt alle noch nicht angewendeten SQL-Migrationen in alphabetischer
 * Reihenfolge aus. Kein externes Framework — nur nummerierte .sql Dateien.
 */
export function runMigrations(db: Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS migrations (
    name   TEXT PRIMARY KEY,
    run_at TEXT NOT NULL
  )`);

  const migrationsDir = join(import.meta.dir, "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const already = db.query("SELECT name FROM migrations WHERE name = ?").get(file);
    if (already) continue;
    db.exec(readFileSync(join(migrationsDir, file), "utf8"));
    db.run("INSERT INTO migrations VALUES (?, ?)", [file, new Date().toISOString()]);
  }
}

/**
 * Atomares Backup der DB. `VACUUM INTO` funktioniert auch unter WAL und ist
 * sicherer als ein File-Copy.
 */
export function backupDatabase(db: Database, destPath: string): void {
  db.run("VACUUM INTO ?", [destPath]);
}
