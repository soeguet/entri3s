---
name: bun-conventions
description: Coding-Konventionen für den Bun Main Process von entries. Verwende diesen Skill für alle Dateien unter src/bun/ — neue Dateien, Edits, Code-Reviews, Architekturentscheidungen. Kein Go, kein Rust — nur TypeScript mit Bun APIs.
---

# Bun Main Process Conventions – entries

## Kontext

In Electrobun läuft der Main Process als Bun-TypeScript-App (ersetzt das frühere
Go). SQLite, GitLab, Worker, Scheduler, Keychain — alles in TypeScript unter
`src/bun/`.

## Schichten (verbindlich)

Strikte Einbahnstraße: `index.ts → app/handlers → service/ → repository/`.

- `index.ts` — nur Wiring (DI), kein Business-Logic. Siehe `src/bun/index.ts`.
- `app/handlers.ts` — RPC-Facade. Delegiert **ausschliesslich** an Services,
  nie direkt aufs Repository. Fängt Exceptions und mappt auf `AppError`.
- `service/` — Business-Logic, ein Service pro Domäne. Gebündelt in
  `service/index.ts` (`createService`).
- `repository/` — SQLite-Zugriff (siehe sqlite-patterns Skill).
- Quer: `gitlab/`, `worker/`, `scheduler/`, `keychain/`, `lib/` (paths,
  logger, app-error, window-url), `app/emitter.ts` + `app/window-emitter.ts`
  (Events → Frontend, siehe electrobun-bridge Skill).

## Dependency Injection

Manuelles Wiring in `src/bun/index.ts`, kein Framework. Reihenfolge:
`openDatabase → createRepository → createGitLabClient → createWindowEmitter →
createService(repo, gl, db, emit) → createRpc(svc)`. Keine Globals, kein
Singleton ausser der `db`-Connection. Die GitLab-Settings werden **live** als
Callback durchgereicht (`() => repo.settings.getAll()`), damit eine geänderte
`gitlabUrl` ohne Neustart wirkt.

## Fehlerbehandlung (kritisch)

Nie rohe Exceptions über RPC. Jeder Handler wird durch das `wrap()`-Helper in
`app/handlers.ts` geführt: `try → { data, error: null }`, `catch → { data: null,
error: toAppError(e) }`.

- `toAppError` (`app/errors.ts`) erkennt `AppErrorError` und mappt sonst auf
  `{ code: "INTERNAL", retry: false }`.
- Services/GitLab-Client werfen typisierte Fehler via `appError(code, message,
  retry?)` aus `lib/app-error.ts` — diese überleben das Mapping mit Code+retry.

## Logging

Strukturierter Logger in `lib/logger.ts`: `createLogger(scope)` →
`info/warn/error(message, fields?)`, schreibt `console.log/warn/error` mit
ISO-Zeitstempel. Kein externes Framework. Scope z. B. `"gitlab"`, `"sync"`,
`"worker"` — der Sync-/Buchungspfad muss im Terminal sichtbar sein.

## App Data Directory

`resolveDataDir()` in `lib/paths.ts`: Windows `%APPDATA%/entries`, sonst
`$XDG_CONFIG_HOME/entries` (Fallback `~/.config/entries`). SQLite, Logs, Backups
liegen hier — nie neben der Binary. Der Pfad wird als Argument weitergereicht,
nie als Global.

## Graceful Shutdown

`win.on("close", …)` in `index.ts` räumt auf: `clearInterval(workerHandle)`,
`clearInterval(schedulerHandle)`, `trayCtl.dispose()`, `db.close()`. Die
`*Handle`-Werte sind die Rückgaben von `startWorker`/`startScheduler`. Window-
Bounds werden debounced gespeichert und beim Close final persistiert.

## Konventionen (Kurzverweise auf CLAUDE.md)

- Datei-Größe, KISS-über-DRY, Props nie destructuren: siehe CLAUDE.md.
- **Typen nur aus `src/shared/types.ts`** — nie eigene Domain-Interfaces in
  `src/bun/` definieren (`import type { Entry } from "../../shared/types"`).
