---
name: sqlite-patterns
description: SQLite-Patterns mit bun:sqlite für entries. Verwende diesen Skill für alle Repository-Dateien, Schema-Definitionen, Migrations und Backup-Logik.
---

# SQLite Patterns – entries (bun:sqlite)

## Connection Setup

```typescript
// src/bun/repository/db.ts
import { Database } from "bun:sqlite";

export function openDatabase(dataDir: string): Database {
  const db = new Database(`${dataDir}/entries.db`, { create: true });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  runMigrations(db);
  return db;
}
```

WAL mode ist Pflicht. Immer. Verhindert `database is locked` bei gleichzeitigem Worker + Scheduler Zugriff.

## Migrations

Kein externes Framework — einfache nummerierte SQL-Dateien:

```typescript
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function runMigrations(db: Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS migrations (
    name TEXT PRIMARY KEY,
    run_at TEXT NOT NULL
  )`);

  const migrationsDir = join(import.meta.dir, "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const already = db.query("SELECT name FROM migrations WHERE name = ?").get(file);
    if (!already) {
      db.exec(readFileSync(join(migrationsDir, file), "utf8"));
      db.run("INSERT INTO migrations VALUES (?, ?)", [file, new Date().toISOString()]);
    }
  }
}
```

Migration-Dateien: `001_initial_schema.sql`, `002_seed_schedules.sql`, ...

## Schema (001_initial_schema.sql)

```sql
CREATE TABLE entries (
    id          INTEGER PRIMARY KEY,
    title       TEXT NOT NULL,
    notes       TEXT,
    duration    INTEGER NOT NULL DEFAULT 0,
    date        DATETIME NOT NULL,
    status      TEXT NOT NULL DEFAULT 'draft',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tickets (
    id              INTEGER PRIMARY KEY,
    gitlab_iid      INTEGER NOT NULL,
    project_id      INTEGER NOT NULL,
    title           TEXT NOT NULL,
    state           TEXT NOT NULL DEFAULT 'opened',
    status          TEXT NOT NULL DEFAULT 'active',
    time_estimate   INTEGER,
    time_spent      INTEGER,
    web_url         TEXT,
    synced_at       DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(gitlab_iid, project_id)
);

CREATE TABLE entry_tickets (
    entry_id  INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    PRIMARY KEY (entry_id, ticket_id)
);

CREATE TABLE tags (
    id    INTEGER PRIMARY KEY,
    name  TEXT NOT NULL UNIQUE,
    color TEXT
);

CREATE TABLE entry_tags (
    entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (entry_id, tag_id)
);

CREATE TABLE templates (
    id      INTEGER PRIMARY KEY,
    name    TEXT NOT NULL UNIQUE,
    payload TEXT NOT NULL
);

CREATE TABLE event_queue (
    id           INTEGER PRIMARY KEY,
    type         TEXT NOT NULL,
    payload      TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',
    retries      INTEGER NOT NULL DEFAULT 0,
    error        TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME
);

CREATE TABLE schedules (
    id           INTEGER PRIMARY KEY,
    name         TEXT NOT NULL UNIQUE,
    interval_sec INTEGER NOT NULL,
    last_run     DATETIME,
    next_run     DATETIME,
    config       TEXT
);

CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE migrations (
    name   TEXT PRIMARY KEY,
    run_at TEXT NOT NULL
);
```

## bun:sqlite Query Patterns

```typescript
// Einzelnes Objekt
const entry = db.query<Entry, number>("SELECT * FROM entries WHERE id = ?").get(id);

// Array
const entries = db.query<Entry, EntryFilter>("SELECT * FROM entries WHERE ...").all(filter);

// Insert mit returning
const { id } = db
  .query<{ id: number }, Entry>("INSERT INTO entries (...) VALUES (?) RETURNING id")
  .get(values)!;

// Prepared statements für häufige Queries
const getEntry = db.query<Entry, number>("SELECT * FROM entries WHERE id = ?");
// Einmal erstellen, mehrfach nutzen
```

## Repository Layer Regeln

- Kein Business Logic im Repository — nur CRUD + Queries
- Alle Methoden synchron (bun:sqlite ist synchron, kein async nötig)
- `null` zurückgeben wenn nicht gefunden, nie Exception werfen
- Errors nach oben propagieren — Mapping auf AppError passiert in handlers.ts

## Event Queue Queries

```typescript
// ClaimNext: atomares Claim via UPDATE...RETURNING
const event = db
  .query(
    `
  UPDATE event_queue SET status = 'processing'
  WHERE id = (SELECT id FROM event_queue WHERE status = 'pending' ORDER BY id LIMIT 1)
  RETURNING *
`,
  )
  .get();

// ResetStuck beim Start
db.run(`UPDATE event_queue SET status = 'pending' WHERE status = 'processing'`);

// Fail mit Dead-Letter
db.run(
  `
  UPDATE event_queue 
  SET retries = retries + 1,
      status = CASE WHEN retries + 1 >= 3 THEN 'dead' ELSE 'pending' END,
      error = ?
  WHERE id = ?
`,
  [errorMsg, id],
);
```

## Timezone

- Immer UTC in der DB: `new Date().toISOString()` → `"2024-01-15T14:30:00.000Z"`
- Konvertierung zu Europe/Berlin NUR im Frontend
- Nie `new Date().toLocaleDateString()` auf Bun-Seite

## Backup

```typescript
// src/bun/repository/db.ts
export function backupDatabase(db: Database, destPath: string) {
  // bun:sqlite unterstützt .backup() direkt
  db.run(`VACUUM INTO ?`, [destPath]);
}
```

`VACUUM INTO` ist atomarer als File-Copy und funktioniert auch unter WAL.
