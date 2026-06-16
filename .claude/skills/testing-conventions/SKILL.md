---
name: testing-conventions
description: Test-Konventionen für entries — bun test für Main Process, Vitest für Frontend. Verwende diesen Skill beim Schreiben von Tests, beim Setup von Test-Infrastruktur, und bei Entscheidungen was wie getestet wird.
---

# Testing Conventions – entries

## Kernprinzip

Der einzige legitime Mock ist `FakeGitLabClient`.
Alles andere testet gegen echtes SQLite (in-memory) oder echte Fixtures.

---

## Bun Test (Main Process: src/bun/)

### Test Runner

```bash
bun test                         # alle Tests
bun test src/bun/repository/     # nur Repository
bun test --watch                 # Watch-Mode
```

Bun's eingebauter Test-Runner, kein Jest, kein Vitest für src/bun/.

### Setup: In-Memory SQLite

```typescript
// src/bun/repository/test-helper.ts
import { Database } from "bun:sqlite";
import { runMigrations } from "./db";

export function createTestDb(): Database {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  runMigrations(db);
  return db;
}
```

```typescript
// src/bun/repository/entry.test.ts
import { test, expect, beforeEach } from "bun:test";
import { createTestDb } from "./test-helper";
import { createEntryRepository } from "./entry";

let repo: ReturnType<typeof createEntryRepository>;

beforeEach(() => {
  const db = createTestDb();
  repo = createEntryRepository(db);
});

test("createEntry returns new id", () => {
  const id = repo.create({
    title: "Test",
    durationMinutes: 60,
    date: "2024-01-15T10:00:00Z",
    status: "draft",
    notes: null,
  });
  expect(id).toBeGreaterThan(0);
});
```

### Was testen (Bun)

- **Repository:** alle CRUD-Methoden, Grenzfälle (not found, duplicate)
- **Event Queue:** enqueue → claimNext → complete/fail, ResetStuck
- **Service/entry:** Overlap Detection (Grenzfälle)
- **Service/sync:** FakeGitLabClient, Orphan Marking, last_synced_at Update
- **Worker:** Retry-Logik, Dead-Letter nach 3 Fehlern
- **gitlab/format:** FormatDuration Edge Cases (0min, 60min, 90min)

### Was NICHT testen (Bun)

- `src/bun/index.ts` (Wiring, zu viel Setup)
- Electrobun APIs selbst
- Scheduler-Timing (setInterval-basiert)

---

## Vitest (Frontend: src/views/main/)

### Kernprinzip

Komponenten importieren aus `src/api/`.
Tests mocken `src/api/` — nie `electrobun/view`, nie `@backend-impl` direkt.

### Setup

```typescript
// src/views/main/src/api/__mocks__/index.ts
import { vi } from "vitest";
import { fixtures } from "../fixtures";

export const getEntries = vi.fn().mockResolvedValue({ data: fixtures.entries, error: null });
export const createEntry = vi.fn().mockResolvedValue({ data: 1, error: null });
export const getTags = vi.fn().mockResolvedValue({ data: fixtures.tags, error: null });
// ... alle exports
```

```typescript
// src/views/main/src/features/entries/EntryList.test.tsx
import { vi, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from '../../lib/test-utils'

vi.mock('../../api')

test('rendert entries aus Mock', async () => {
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <EntryList />
    </QueryClientProvider>
  )
  await screen.findByText(fixtures.entries[0].title)
})
```

### Was testen (Vitest)

- Feature-Komponenten: Rendering, User-Interaktionen
- Form-Validierung: Zod-Schemas, Fehleranzeige
- Error-States: wenn API `{ data: null, error: {...} }` zurückgibt
- Route-Übergänge via TanStack Router Memory History

### Was NICHT testen (Vitest)

- shadcn/ui oder Radix Internals
- TanStack Table oder Query Internals
- `src/api/real.ts` (integration concern)

---

## Fixtures

```typescript
// src/views/main/src/fixtures/entries.ts
import type { Entry } from "../../../../shared/types";

export const fixtures = {
  entries: [
    {
      id: 1,
      title: "Feature X implementiert",
      durationMinutes: 90,
      date: "2024-01-15T09:00:00Z",
      status: "draft",
      notes: null,
      createdAt: "2024-01-15T09:00:00Z",
      updatedAt: "2024-01-15T09:00:00Z",
    },
  ] satisfies Entry[],
};
```

Fixtures sind typisiert mit Types aus `src/shared/types.ts`.
Wenn ein Typ sich ändert, bricht der Build — kein Drift möglich.

---

## mise Tasks

```bash
mise run test-bun   # bun test ./src/bun/
mise run test-fe    # vitest run in src/views/main/
mise run test       # beide nacheinander
```
