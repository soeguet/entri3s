---
name: bun-conventions
description: Coding-Konventionen für den Bun Main Process von entries. Verwende diesen Skill für alle Dateien unter src/bun/ — neue Dateien, Edits, Code-Reviews, Architekturentscheidungen. Kein Go, kein Rust — nur TypeScript mit Bun APIs.
---

# Bun Main Process Conventions – entries

## Kontext

In Electrobun läuft der Main Process als Bun-TypeScript-App.
Das ersetzt was früher Go war. SQLite, GitLab, Worker, Scheduler, Keychain —
alles in TypeScript unter `src/bun/`.

## Dateistruktur

```
src/bun/
├── index.ts              ← Einstiegspunkt, Window + RPC-Setup, kein Logic
├── app/
│   └── handlers.ts       ← RPC-Handler-Facade (delegiert an service/)
├── service/
│   ├── entry.ts
│   ├── sync.ts
│   └── booking.ts
├── repository/
│   ├── db.ts             ← Connection-Setup, Migration-Runner
│   ├── entry.ts
│   ├── ticket.ts
│   ├── tag.ts
│   ├── template.ts
│   ├── event-queue.ts
│   ├── schedule.ts
│   ├── settings.ts
│   └── migrations/       ← nummerierte .sql Dateien
├── gitlab/
│   ├── client.ts
│   ├── fetch.ts
│   ├── push.ts
│   └── format.ts
├── worker/
│   └── worker.ts
├── scheduler/
│   └── scheduler.ts
└── keychain/
    └── keychain.ts
```

## Datei-Größe

- **250–300 LOC** sweet spot. Hard limit ~350.
- Splitten nach Verantwortung wenn Limit naht.

## KISS über DRY

- Lieber duplizieren als eine fragwürdige Abstraktion einführen.
- Keine Abstraktion bis zum dritten Mal.
- Boring und lesbar schlägt clever.

## Typen

**Alle Domain-Typen und RPC-Typen kommen aus `src/shared/types.ts`.**
Nie eigene Interfaces in `src/bun/` definieren die Domain-Objekte beschreiben.

```typescript
// FALSCH
interface Entry {
  id: number;
  title: string;
}

// RICHTIG
import type { Entry, EntryFilter } from "../../shared/types";
```

## Dependency Injection

Manuelles Wiring in `src/bun/index.ts`, kein Framework:

```typescript
const db = openDatabase(dataDir);
const repo = createRepository(db);
const glClient = createGitLabClient(token, baseUrl);
const svc = createService(repo, glClient);
```

Keine Globals, kein Singleton-Pattern außer für `db` selbst.

## Fehlerbehandlung

RPC-Handler fangen Exceptions ab und mappen auf `AppError`:

```typescript
// In handlers.ts
getEntries: async (filter) => {
  try {
    return { data: await svc.entry.getAll(filter), error: null };
  } catch (e) {
    return { data: null, error: toAppError(e) };
  }
};
```

`toAppError` in `src/bun/app/errors.ts` mappt bekannte Fehlercodes.

## Logging

`console.log/error` mit strukturierten Objekten reicht für Bun.
In einer späteren Phase: File-Logging via `Bun.file` schreiben.
Kein externes Logging-Framework.

## App Data Directory

```typescript
import { paths } from "electrobun/bun";
// oder manuell:
const dataDir = path.join(process.env.APPDATA ?? process.env.HOME ?? ".", "entries");
await Bun.mkdir(dataDir, { recursive: true });
```

SQLite-Datei, Logs — alles in `dataDir`. Nie neben der Binary.

## Graceful Shutdown

```typescript
win.on("close", () => {
  clearInterval(workerHandle);
  clearInterval(schedulerHandle);
  db.close();
});
```

`workerHandle` und `schedulerHandle` sind die Rückgabewerte von `setInterval`.

## index.ts – Nur Wiring

```typescript
// src/bun/index.ts – kein Business Logic hier
import { BrowserWindow, BrowserView } from "electrobun/bun";
import { createRpc } from "./app/handlers";
import { openDatabase } from "./repository/db";
// ...

const db = openDatabase(dataDir);
const repo = createRepository(db);
const rpc = createRpc(repo, glClient);

const win = new BrowserWindow({
  title: "entries",
  url: "views://main/index.html",
  rpc,
});

win.on("close", () => {
  /* shutdown */
});
```
