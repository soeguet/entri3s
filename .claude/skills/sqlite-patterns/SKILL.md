---
name: sqlite-patterns
description: SQLite-Patterns mit bun:sqlite für entries. Verwende diesen Skill für alle Repository-Dateien, Schema-Definitionen, Migrations und Backup-Logik.
---

# SQLite Patterns – entries (bun:sqlite)

Quelle der Wahrheit: `src/bun/repository/db.ts` (Connection, Migration-Runner,
Backup), `repository/migrations/*.sql` (Schema), `repository/index.ts` (Wiring).

## Connection Setup (db.ts)

`openDatabase(dataDir)` macht in dieser Reihenfolge: `mkdirSync(dataDir)`,
`new Database(.../entries.db, { create: true })`, dann drei PRAGMAs, dann
`runMigrations`:

- **`PRAGMA journal_mode = WAL` ist Pflicht, immer.** Verhindert `database is
  locked`, wenn Worker und Scheduler gleichzeitig zugreifen. WAL persistiert auf
  der DB-Datei — einmal gesetzt bleibt es.
- `PRAGMA busy_timeout = 5000` — 5 s warten statt sofort `SQLITE_BUSY`.
- `PRAGMA foreign_keys = ON` — Foreign Keys sind in SQLite per Default AUS und
  müssen pro Connection aktiviert werden, sonst greifen die `ON DELETE CASCADE`
  in den Relationstabellen nicht.

## Migrations (db.ts → runMigrations)

Kein externes Framework. Nummerierte `.sql`-Dateien in `repository/migrations/`,
alphabetisch sortiert ausgeführt. Idempotenz über eine `migrations`-Tabelle
(`name PRIMARY KEY, run_at`): bereits eingetragene Dateien werden übersprungen,
neue per `db.exec(file)` ausgeführt und mit `toISOString()` eingetragen.

- Migrationen sind **append-only und unveränderlich** — eine schon angewendete
  Datei nie editieren, immer eine neue `NNN_*.sql` anhängen. Das Schema ist die
  Summe aller Migrationen, nicht eine einzelne Datei (z. B. droppt
  `004_drop_entry_title.sql` die ursprüngliche `entries.title`-Spalte).
- `mise run migrate` führt sie als Dev-Skript gegen die echte DB aus
  (`repository/migrate.ts`).

## bun:sqlite Query Patterns

`bun:sqlite` ist **synchron** — kein `async` in Repositories. Getypte Queries:

```typescript
db.query<Row, [number]>("SELECT * FROM entries WHERE id = ?").get(id); // Objekt | null
db.query<Row, Params>("SELECT ...").all(...params);                    // Array
db.query<{ id: number }, [...]>("INSERT ... RETURNING id").get(...)!;  // Insert mit id
```

Row-Typen (snake_case DB-Spalten) sind **lokale Interfaces im Repo** und werden
über eine `toX()`-Funktion auf die camelCase Domain-Typen aus
`src/shared/types.ts` gemappt (siehe `repository/entry.ts`). Filter werden
dynamisch als `WHERE`-Teile + Params-Array gebaut (`entry.ts list()`).

## Repository Layer Regeln

- Nur CRUD + Queries, kein Business-Logic (das gehört in `service/`).
- `null` zurückgeben wenn nicht gefunden, nie Exception werfen.
- Fehler nach oben propagieren; Mapping auf `AppError` passiert in
  `app/handlers.ts` (siehe bun-conventions Skill).

## Event Queue (event-queue.ts)

Persistente Job-Queue mit Dead-Letter, `MAX_RETRIES = 3`:

- **`claimNext()`** — atomares Claim via `UPDATE ... WHERE id = (SELECT ...
  status='pending' ORDER BY id LIMIT 1) RETURNING ...`. Ein einziges Statement,
  kein Race zwischen Worker-Ticks.
- **`resetStuck()`** — beim Start (`index.ts` ruft `repo.eventQueue.resetStuck()`)
  setzt hängende `'processing'`-Events zurück auf `'pending'` (Absturz-Recovery).
- **`fail()`** — `retries+1`; ab `MAX_RETRIES` → Status `'dead'`. Gibt den neuen
  Status zurück, damit der Worker den Entry bei Dead-Letter terminal markieren
  kann. `retryDead` / `discardDead` für die manuelle UI-Behandlung.

## Timezone (verbindlich)

- DB speichert **immer UTC**: `new Date().toISOString()`.
- Konvertierung nach `Europe/Berlin` **nur im Frontend**.
- Nie `toLocaleDateString()` o. ä. auf Bun-Seite.

## Backup (db.ts → backupDatabase)

`db.run("VACUUM INTO ?", [destPath])`. Atomar und WAL-sicher — sicherer als ein
File-Copy, der bei aktivem WAL inkonsistent wäre.
