---
name: testing-conventions
description: Test-Konventionen für entries — bun test für Main Process, Vitest für Frontend. Verwende diesen Skill beim Schreiben von Tests, beim Setup von Test-Infrastruktur, und bei Entscheidungen was wie getestet wird.
---

# Testing Conventions – entries

## Kernprinzip

Zwei getrennte Runner: **`bun test` für `src/bun/`**, **Vitest für
`src/views/main/`**. Der einzige legitime Mock im Backend ist
`FakeGitLabClient`; alles andere testet gegen echtes In-Memory-SQLite oder echte
Fixtures. Im Frontend wird `src/api/` gemockt — nie `electrobun/view` direkt.

## Tasks

- `mise run test-bun` → `bun test ./src/bun/`
- `mise run test-fe` → `cd src/views/main && bun run vitest run`
- `mise run test` → beide (`depends`).

Ad-hoc: `bun test ./src/bun/repository/`, `bun test --watch`. Kein Jest, kein
Vitest für `src/bun/`.

---

## Bun Test (Main Process)

### Setup: In-Memory SQLite

`src/bun/repository/test-helper.ts` → `createTestDb()`: `new Database(":memory:")`,
`PRAGMA foreign_keys = ON`, dann `runMigrations` (volles Schema). Frische DB pro
Test in `beforeEach`. Typisches Pattern (siehe `repository/entry.test.ts`):

```typescript
import { test, expect, beforeEach } from "bun:test";
import { createTestDb } from "./test-helper";
import { createRepository, type Repository } from "./index";

let full: Repository;
beforeEach(() => {
  full = createRepository(createTestDb()); // ganzes Repo, damit Relationen (tickets/tags) testbar sind
});
```

Entry-Inputs kommen über einen `input(overrides)`-Builder mit den realen
Domain-Feldern (`notes`, `durationMinutes`, `date`, `status`, `tagIds`,
`ticketIds` — **kein `title`**).

### FakeGitLabClient

`new FakeGitLabClient()` aus `src/bun/gitlab/types.ts` — die EINZIGE legitime
Mock-Klasse. Genutzt in `service/sync.test.ts` und `worker/worker.test.ts`.

`gitlab/client.test.ts` geht anders vor: es stubt `globalThis.fetch` direkt (mit
`afterEach`-Restore), um Fehler-Mapping zu prüfen — jede `fetch`-Variante muss
auf den richtigen `AppError`-Code + `retry` mappen (`GITLAB_ERROR`,
`AUTH_FAILED`, `NETWORK_ERROR` retryable, `NO_GITLAB_URL` vor jedem Request).

### Was testen (Bun)

- Repository: CRUD + Grenzfälle (not found, Filter-Kombinationen, Dedup).
- Event Queue: enqueue → claimNext → complete/fail, resetStuck, Dead-Letter nach
  `MAX_RETRIES`.
- Service/entry (Overlap), Service/sync (Orphan-Marking via Fake), Worker-Retry.
- `gitlab/format`, `gitlab/client` Fehler-Mapping.

### Was NICHT testen (Bun)

`index.ts` (reines Wiring), Electrobun-APIs selbst, Scheduler-Timing.

---

## Vitest (Frontend)

### Setup

`vitest.config.ts`: `environment: "jsdom"`, `globals: true`, setupFile
`vitest.setup.ts` (importiert `@testing-library/jest-dom/vitest`). Der
`@backend-impl`-Alias zeigt in Tests fest auf `src/api/mock.ts`.

Komponenten-Tests mocken zusätzlich `src/api/` via `vi.mock("../../api")`. Der
manuelle Mock liegt in `src/api/__mocks__/index.ts`: pro Export ein `vi.fn`, das
ein `{ data, error: null }`-Promise liefert (`okResp`/`voidResp`-Helper). Tests
können einzelne Funktionen überschreiben.

### Was testen (Vitest)

Feature-Komponenten (Rendering, Interaktion), Form-/Zod-Validierung,
Error-States (`{ data: null, error }`), Router-Übergänge.

### Was NICHT testen (Vitest)

shadcn/Radix-Internals, TanStack Table/Query-Internals, `src/api/real.ts`
(Integration-Concern).

---

## Fixtures

`src/views/main/src/fixtures/*` (zentral re-exportiert als `fixtures`). Typisiert
mit den Domain-Typen aus `src/shared/types.ts` via `satisfies` — ändert sich ein
Typ, bricht der Build, kein Drift.
