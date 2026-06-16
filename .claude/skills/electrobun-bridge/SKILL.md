---
name: electrobun-bridge
description: Electrobun RPC-Pattern für entries. Verwende diesen Skill für alles was die Grenze zwischen Bun Main Process und React Frontend betrifft — RPC-Definitionen, shared types, Mock/Real-Swap, Events. Ersetzt den alten wails-bridge Skill vollständig.
---

# Electrobun Bridge – entries

## Das Kernprinzip

**`src/shared/types.ts` ist die einzige Source of Truth für alle Typen.**
Bun-Seite und Frontend-Seite importieren aus derselben Datei.
Kein Codegen. Kein Drift möglich.

```
src/
├── shared/types.ts     ← EINZIGE Quelle für Typen
├── bun/                ← importiert aus shared/types.ts
└── views/main/         ← importiert aus ../../../../shared/types.ts
```

## shared/types.ts Struktur

```typescript
import type { RPCSchema } from "electrobun/bun";

// Domain Types
export interface Entry {
  id: number;
  title: string;
  notes: string | null;
  durationMinutes: number;
  date: string; // ISO UTC
  status: "draft" | "pending_booking" | "booked" | "orphaned";
  createdAt: string;
  updatedAt: string;
}
export interface EntryFilter {
  dateFrom?: string;
  dateTo?: string;
  status?: Entry["status"];
  tagIds?: number[];
}
export interface Ticket {
  /* ... */
}
export interface Tag {
  /* ... */
}
export interface Template {
  /* ... */
}
export interface AppEvent {
  id: number;
  type: string;
  status: string;
  error: string | null;
}
export interface Settings {
  gitlabUrl: string;
  projectId: number;
  syncIntervalSec: number;
}
export interface AppError {
  code: string;
  message: string;
  retry: boolean;
}

// RPC Response Wrapper
export type RpcResponse<T> = { data: T; error: null } | { data: null; error: AppError };

// RPC Type Definition
export type AppRPCType = {
  bun: RPCSchema<{
    requests: {
      getEntries: { params: EntryFilter; response: RpcResponse<Entry[]> };
      getEntry: { params: { id: number }; response: RpcResponse<Entry> };
      createEntry: {
        params: Omit<Entry, "id" | "createdAt" | "updatedAt">;
        response: RpcResponse<number>;
      };
      updateEntry: { params: Entry; response: RpcResponse<void> };
      deleteEntry: { params: { id: number }; response: RpcResponse<void> };
      getTickets: { params: { status?: string }; response: RpcResponse<Ticket[]> };
      assignTicket: { params: { entryId: number; ticketId: number }; response: RpcResponse<void> };
      removeTicket: { params: { entryId: number; ticketId: number }; response: RpcResponse<void> };
      bookEntry: { params: { entryId: number }; response: RpcResponse<void> };
      getDeadEvents: { params: Record<string, never>; response: RpcResponse<AppEvent[]> };
      retryDeadEvent: { params: { eventId: number }; response: RpcResponse<void> };
      getTags: { params: Record<string, never>; response: RpcResponse<Tag[]> };
      createTag: { params: Omit<Tag, "id">; response: RpcResponse<number> };
      deleteTag: { params: { id: number }; response: RpcResponse<void> };
      getTemplates: { params: Record<string, never>; response: RpcResponse<Template[]> };
      createTemplate: { params: Omit<Template, "id">; response: RpcResponse<number> };
      updateTemplate: { params: Template; response: RpcResponse<void> };
      deleteTemplate: { params: { id: number }; response: RpcResponse<void> };
      triggerSync: { params: Record<string, never>; response: RpcResponse<void> };
      getSettings: { params: Record<string, never>; response: RpcResponse<Settings> };
      saveSettings: { params: Settings; response: RpcResponse<void> };
      setGitLabToken: { params: { token: string }; response: RpcResponse<void> };
      backupDatabase: { params: { destPath: string }; response: RpcResponse<void> };
    };
    messages: {};
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {
      syncCompleted: Record<string, never>;
      syncFailed: { error: string };
      bookingCompleted: Record<string, never>;
      bookingFailed: { error: string };
      orphanDetected: { count: number };
    };
  }>;
};
```

## Bun-Seite: RPC Handler

```typescript
// src/bun/app/handlers.ts
import { BrowserView } from "electrobun/bun";
import type { AppRPCType } from "../../shared/types";

export function createRpc(svc: Services) {
  return BrowserView.defineRPC<AppRPCType>({
    maxRequestTime: 10_000,
    handlers: {
      requests: {
        getEntries: async (filter) => {
          try {
            return { data: await svc.entry.getAll(filter), error: null };
          } catch (e) {
            return { data: null, error: toAppError(e) };
          }
        },
        // ...
      },
      messages: {},
    },
  });
}
```

## Frontend-Seite: Electroview

```typescript
// src/views/main/src/api/real.ts
import { Electroview } from "electrobun/view";
import type { AppRPCType, EntryFilter, Entry } from "../../../../shared/types";

const rpc = Electroview.defineRPC<AppRPCType>({
  handlers: {
    requests: {},
    messages: {
      syncCompleted: () => {
        /* handled in events.ts */
      },
      bookingCompleted: () => {},
      bookingFailed: () => {},
      orphanDetected: () => {},
      syncFailed: () => {},
    },
  },
});
export const electroview = new Electroview({ rpc });

export const getEntries = (filter: EntryFilter) => electroview.rpc.request.getEntries(filter);
export const createEntry = (entry: Omit<Entry, "id" | "createdAt" | "updatedAt">) =>
  electroview.rpc.request.createEntry(entry);
// ...alle weiteren exports
```

## Mock/Real Swap (unveränderter Vite-Alias-Pattern)

```typescript
// vite.config.ts (in src/views/main/)
resolve: {
  alias: {
    '@backend-impl': resolve(
      __dirname,
      process.env.VITE_MOCK === 'true' ? 'src/api/mock.ts' : 'src/api/real.ts'
    )
  }
}
```

```typescript
// src/api/mock.ts
import type { Entry } from "../../../../shared/types";
import { fixtures } from "../fixtures/entries";
export const getEntries = async () => ({ data: fixtures, error: null });
export const createEntry = async () => ({ data: 1, error: null });
```

```typescript
// src/api/index.ts
export * from "@backend-impl";
```

## Events: Bun → Frontend

```typescript
// In bun: nach Sync
win.webview.rpc.send.syncCompleted({});

// In frontend (src/views/main/src/api/events.ts):
import { queryClient } from "../lib/queryClient";
import { keys } from "../lib/queryKeys";
// Events werden in real.ts via Electroview message handlers registriert
// und rufen queryClient.invalidateQueries auf
```

Events werden in `src/api/real.ts` in den message handlers registriert
und `queryClient.invalidateQueries` aufrufen.
Nie Event-Handler in Komponenten.

## Regeln

- `src/shared/types.ts` ist die EINZIGE Quelle für Typen — nie woanders definieren
- Frontend importiert nur aus `src/api/` — nie direkt `electrobun/view` in Komponenten
- Kein `any` über die RPC-Grenze
- Jeder Request gibt `RpcResponse<T>` zurück — Frontend prüft immer `.error`
