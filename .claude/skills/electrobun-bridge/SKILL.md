---
name: electrobun-bridge
description: Electrobun RPC-Pattern für entries. Verwende diesen Skill für alles was die Grenze zwischen Bun Main Process und React Frontend betrifft — RPC-Definitionen, shared types, Mock/Real-Swap, Events. Ersetzt den alten wails-bridge Skill vollständig.
---

# Electrobun Bridge – entries

## Kernprinzip

**`src/shared/types.ts` ist die einzige Source of Truth für alle Domain- und
RPC-Typen.** Bun-Seite und Frontend importieren aus derselben Datei. Kein
Codegen, kein Drift. Nie Domain-Typen woanders definieren.

- `src/bun/` importiert aus `../../shared/types`.
- `src/views/main/` importiert aus `../../../../shared/types`.
- Reine TypeScript-Typen — `types.ts` selbst importiert **nicht** aus
  `electrobun/*` (hält das Frontend-Bundle schlank).

## RPC-Schema (types.ts → AppRPCType)

`AppRPCType` hat zwei Seiten (siehe `src/shared/types.ts`):

- `bun: RPCSchema<{ requests; messages }>` — Request/Response vom Frontend an
  Bun. Jeder Request: `{ params; response: RpcResponse<T> }`.
- `webview: RPCSchema<{ requests; messages }>` — die `messages` sind die
  Push-Events Bun → Frontend (`syncCompleted`, `syncFailed`, `bookingCompleted`,
  `bookingFailed`, `orphanDetected`, `runningEntryChanged`).

`RpcResponse<T> = { data: T; error: null } | { data: null; error: AppError }`.
Jeder Request gibt das zurück; das Frontend prüft **immer** `.error`. Kein `any`
über die Grenze.

## Bun-Seite: RPC-Handler

`src/bun/app/handlers.ts` → `createRpc(svc)` via `BrowserView.defineRPC<AppRPCType>`
(`maxRequestTime: 10_000`). Jeder Handler delegiert an einen Service und wird vom
`wrap()`-Helper in try/catch → `RpcResponse` gehüllt (Details siehe
bun-conventions Skill). Kein direkter Repository-Zugriff in der Facade.

## Frontend-Seite: real.ts

`src/views/main/src/api/real.ts` ist die **einzige** Datei, die `electrobun/view`
importiert. Sie baut `Electroview.defineRPC<AppRPCType>` und exportiert pro
Request eine dünne Funktion über die Request-Bridge:

```typescript
const electroview = new Electroview({ rpc });
const r = electroview.rpc!.request; // Frontend ruft NIE Backend-Code direkt
export const getEntries = (filter: EntryFilter) => r.getEntries(filter);
```

Komponenten importieren ausschliesslich aus `src/api/` (→ `index.ts`), nie
`electrobun/view` direkt und nie `r`/`electroview` direkt.

## Mock/Real Swap (Vite-Alias)

`src/api/index.ts` macht `export * from "@backend-impl"`. Der Alias wird in
`vite.config.ts` **nach Vite-Mode** aufgelöst (nicht über eine Env-Var):

```typescript
// vite.config.ts
"@backend-impl": resolve(__dirname, mode === "mock" ? "src/api/mock.ts" : "src/api/real.ts");
```

- `--mode mock` → `mock.ts`: In-Memory-Store aus `src/fixtures/*`, ohne
  Electrobun (Browser-Dev, `mise run dev`).
- sonst → `real.ts`: echte RPC-Bridge.
- `src/api/__mocks__/index.ts` ist separat — das Vitest-Modul-Mock für Tests.

Beide Implementierungen exportieren dieselbe Signatur (aus `types.ts`), damit
der Swap typsicher ist.

## Events: Bun → Frontend

Backend-Pfad ist über `AppEmitter` abstrahiert (`src/bun/app/emitter.ts`):

- `AppEmitter`-Interface + `noopEmitter` für Tests.
- `createWindowEmitter(getWin)` (`window-emitter.ts`) ist die echte
  Implementierung; sendet via `getWin()?.webview?.rpc?.send.<event>(...)`.
  Optional-Chaining schützt vor noch nicht bereiter Webview (Fenster wird in
  `index.ts` lazy nachgereicht).
- Services bekommen den Emitter injiziert und feuern Events (z. B.
  `emit.syncFailed(msg)`) — Fire-and-Forget, kein Rückkanal.

Frontend-Seite: die `messages`-Handler in `real.ts` rufen
`queryClient.invalidateQueries`/`setQueryData` + Toast auf. **Nie Event-Handler
in Komponenten.**
