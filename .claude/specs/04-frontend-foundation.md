# Phase 04 – Frontend Foundation

**Ziel:** Vollständige Frontend-Infrastruktur: Routing, State, Layout, Mock/Real-Swap, Events — ohne noch ein Feature zu bauen.

**Voraussetzung:** Phase 03 ✅

**Skills lesen:** `react-typescript`, `electrobun-bridge`

---

## 1. Dependencies

```bash
cd src/views/main
bun add @tanstack/react-router @tanstack/react-query @tanstack/react-table
bun add react-hook-form zod @hookform/resolvers
bun add date-fns date-fns-tz
bun add -D tailwindcss @tailwindcss/vite vitest @testing-library/react
npx shadcn@latest init
npx shadcn@latest add button input label dialog table sidebar separator badge
```

### Checkliste

- [ ] Alle Dependencies installiert
- [ ] Tailwind konfiguriert
- [ ] shadcn/ui init mit `style: default`, `baseColor: slate`
- [ ] `mise run dev` startet ohne Fehler

---

## 2. Vite Config – Mock/Real Swap

```typescript
// src/views/main/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@backend-impl": resolve(__dirname, mode === "mock" ? "src/api/mock.ts" : "src/api/real.ts"),
    },
  },
}));
```

### Checkliste

- [ ] `vite.config.ts` mit Mode-basiertem Alias
- [ ] `src/api/real.ts`: importiert `electrobun/view`, exportiert alle API-Funktionen
- [ ] `src/api/mock.ts`: gleiche Exports, nutzt Fixtures, kein `electrobun/view` Import
- [ ] `src/api/index.ts`: `export * from '@backend-impl'`
- [ ] `src/fixtures/entries.ts`, `tickets.ts`, `tags.ts` mit sinnvollen Testdaten (typisiert mit `src/shared/types.ts`)
- [ ] `mise run dev` (= `vite --mode mock`) nutzt Mocks
- [ ] `mise run dev-electrobun` nutzt real.ts

---

## 3. TanStack Router

```
src/views/main/src/routes/
├── __root.tsx          ← Root Layout (Sidebar + Outlet)
├── index.tsx           ← Redirect zu /entries
├── entries/
│   ├── index.tsx
│   └── $entryId.tsx
├── tickets/
│   └── index.tsx
├── management/
│   └── index.tsx
└── settings/
    └── index.tsx
```

### Checkliste

- [ ] `createRouter` in `main.tsx`
- [ ] `RouterProvider` als Root
- [ ] `__root.tsx`: Layout mit Sidebar + `<Outlet />`
- [ ] Alle Routen angelegt (leer ist ok)
- [ ] Navigation in Sidebar mit active-State
- [ ] `/` redirectet zu `/entries`
- [ ] 404-Fallback

---

## 4. Layout

### Checkliste

- [ ] Sidebar links, fixed, nicht scrollbar
- [ ] Nav-Items: Entries, Tickets, Management, Settings
- [ ] Content rechts, scrollbar, `max-w-4xl`, zentriert, Padding
- [ ] Page-Title im Content-Bereich
- [ ] shadcn/ui Sidebar-Komponente nutzen

---

## 5. TanStack Query + Query Keys

```typescript
// src/lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});
```

```typescript
// src/lib/queryKeys.ts
export const keys = {
  entries: (filter?: EntryFilter) => ["entries", filter] as const,
  entry: (id: number) => ["entry", id] as const,
  tickets: (filter?: TicketFilter) => ["tickets", filter] as const,
  tags: () => ["tags"] as const,
  templates: () => ["templates"] as const,
  deadEvents: () => ["deadEvents"] as const,
  settings: () => ["settings"] as const,
};
```

### Checkliste

- [ ] `src/lib/queryClient.ts`
- [ ] `src/lib/queryKeys.ts` — Query Keys als Konstanten, nie inline Strings
- [ ] `QueryClientProvider` in `main.tsx`

---

## 6. Events (Bun → Frontend)

Events werden in `src/api/real.ts` via Electroview message handlers registriert:

```typescript
// src/api/real.ts (Auszug)
const rpc = Electroview.defineRPC<AppRPCType>({
  handlers: {
    requests: {},
    messages: {
      syncCompleted: () => {
        queryClient.invalidateQueries({ queryKey: keys.tickets() });
        queryClient.invalidateQueries({ queryKey: keys.entries() });
      },
      bookingCompleted: () => {
        queryClient.invalidateQueries({ queryKey: keys.entries() });
        queryClient.invalidateQueries({ queryKey: keys.deadEvents() });
      },
      bookingFailed: () => {
        queryClient.invalidateQueries({ queryKey: keys.deadEvents() });
      },
      orphanDetected: () => {
        queryClient.invalidateQueries({ queryKey: keys.tickets() });
      },
      syncFailed: () => {},
    },
  },
});
```

### Checkliste

- [ ] Events in `real.ts` als message handlers registriert
- [ ] `mock.ts` hat leere message handler Stubs (no-op)
- [ ] Keine Event-Subscriptions in Komponenten
- [ ] Query Keys aus `queryKeys.ts` verwendet

---

## 7. Utility-Dateien

### Checkliste

- [ ] `src/lib/errors.ts`: `isAppError(v)`, `errorMessage(err)`
- [ ] `src/lib/dates.ts`: `formatDate()`, `formatDateTime()`, `formatDuration()` — alles Europe/Berlin

---

## 8. React Compiler

### Checkliste

- [ ] React 19, Compiler-Plugin konfiguriert
- [ ] Kein manuelles `useMemo` / `useCallback` in neuem Code
- [ ] `mise run doctor` — keine kritischen Findings

---

## Definition of Done

- [ ] `mise run dev` — App im Browser, alle Routen navigierbar, Sidebar funktioniert
- [ ] `mise run dev-electrobun` — Layout korrekt in Electrobun
- [ ] `mise run lint` sauber
- [ ] `mise run doctor` sauber
- [ ] Mock-Fixtures zeigen sinnvolle Testdaten
- [ ] Query Keys sind Konstanten

**→ Phase 04 ✅ in PLAN.md setzen, Phase 05 beginnen**
