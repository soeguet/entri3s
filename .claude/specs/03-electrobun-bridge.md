# Phase 03 – Electrobun Bridge

**Ziel:** `src/shared/types.ts` als vollständige Type-Definition, RPC-Handler als Facade, Events verdrahtet, `mise run dev-electrobun` zeigt funktionsfähige App.

**Voraussetzung:** Phase 02 ✅

**Skills lesen:** `electrobun-bridge`, `bun-conventions`

---

## 1. src/shared/types.ts – Vollständig

Das wichtigste File im Projekt. Beide Seiten importieren von hier.

### Checkliste

- [ ] Alle Domain Types: `Entry`, `EntryFilter`, `Ticket`, `TicketFilter`, `Tag`, `Template`, `AppEvent`, `Settings`, `AppError`
- [ ] `RpcResponse<T>` Union Type
- [ ] `AppRPCType` mit vollständiger `bun.requests` Definition (alle Use Cases aus `electrobun-bridge` Skill)
- [ ] `AppRPCType` mit `webview.messages`: `syncCompleted`, `syncFailed`, `bookingCompleted`, `bookingFailed`, `orphanDetected`
- [ ] Kein Import aus `electrobun/*` in types.ts — nur reine TypeScript-Typen
- [ ] TypeScript kompiliert: `bun run tsc --noEmit`

---

## 2. RPC Handler Facade

`src/bun/app/handlers.ts` — delegiert an Service, mappt Exceptions auf AppError.

### Checkliste

- [ ] `createRpc(svc, win)` gibt `BrowserView.defineRPC<AppRPCType>()` zurück
- [ ] Jeder Handler: try/catch, `{ data: result, error: null }` oder `{ data: null, error: toAppError(e) }`
- [ ] `src/bun/app/errors.ts`: `toAppError(e: unknown): AppError` mappt bekannte Error-Typen
- [ ] Handlers für alle Request-Typen aus `AppRPCType`
- [ ] `handlers.ts` unter 300 LOC — ggf. splitten in `handlers/entry.ts`, `handlers/tickets.ts` etc.
- [ ] Kein direkter Repository-Zugriff in handlers — nur via `svc`

---

## 3. src/bun/index.ts – Vollständiges Wiring

```typescript
import { BrowserWindow } from "electrobun/bun";
import { openDatabase, backupDatabase } from "./repository/db";
import { createRepository } from "./repository";
import { createService } from "./service";
import { createGitLabClient } from "./gitlab/client";
import { createRpc } from "./app/handlers";
import { startWorker } from "./worker/worker";
import { startScheduler } from "./scheduler/scheduler";
import { getToken } from "./keychain/keychain";
import { resolveDataDir } from "./lib/paths";

const dataDir = resolveDataDir();
const db = openDatabase(dataDir);
const repo = createRepository(db);

repo.eventQueue.resetStuck();

const token = (await getToken()) ?? "";
const settings = repo.settings.getAll();
const glClient = createGitLabClient(token, settings);
const svc = createService(repo, glClient);

const win = new BrowserWindow({
  title: "entries",
  url: "views://main/index.html",
  frame: { width: 1280, height: 800 },
  rpc: createRpc(svc, win),
});

const workerHandle = startWorker(repo, glClient, win);
const schedulerHandle = startScheduler(repo, svc, win);

win.on("close", () => {
  clearInterval(workerHandle);
  clearInterval(schedulerHandle);
  db.close();
});
```

### Checkliste

- [ ] `src/bun/index.ts` folgt exakt diesem Pattern
- [ ] `src/bun/lib/paths.ts`: `resolveDataDir()` plattformübergreifend
- [ ] `index.ts` unter 60 LOC — kein Logic hier
- [ ] `mise run dev-electrobun` startet ohne Panic/Fehler

---

## 4. Events: Bun → Frontend

### Checkliste

- [ ] Worker sendet nach Booking: `win.webview.rpc.send.bookingCompleted({})`
- [ ] Worker sendet bei Fehler: `win.webview.rpc.send.bookingFailed({ error: e.message })`
- [ ] Scheduler/Sync sendet: `win.webview.rpc.send.syncCompleted({})` / `syncFailed({ error })`
- [ ] Sync sendet bei orphans: `win.webview.rpc.send.orphanDetected({ count: n })`
- [ ] Alle Event-Namen matchen exakt die `webview.messages` Definitionen in types.ts

---

## Definition of Done

- [ ] `mise run dev-electrobun` startet ohne Fehler
- [ ] RPC-Calls vom Frontend (sobald Phase 04 fertig) gehen durch
- [ ] Maximal ~20 Request-Typen in AppRPCType
- [ ] Kein direkter Repo-Zugriff in `app/`
- [ ] `bun run tsc --noEmit` sauber

**→ Phase 03 ✅ in PLAN.md setzen, Phase 04 beginnen**
