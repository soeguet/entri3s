---
name: react-typescript
description: React und TypeScript Konventionen für das Frontend (src/views/main/). Verwende diesen Skill für alle Frontend-Dateien — neue Komponenten, Edits, Reviews. Kein Go, keine Wails-Typen — nur React mit Typen aus src/shared/types.ts.
---

# React/TypeScript Conventions – entries Frontend

## Dateistruktur

```
src/views/main/
├── index.html
├── main.tsx
├── vite.config.ts
└── src/
    ├── api/
    │   ├── real.ts       ← EINZIGE Datei die electrobun/view importiert
    │   ├── mock.ts       ← Gleiche Exports, Fixture-Daten
    │   └── index.ts      ← re-exportiert von @backend-impl
    ├── features/
    │   ├── entries/
    │   ├── tickets/
    │   ├── settings/
    │   └── management/
    ├── routes/
    ├── components/       ← Nur geteilte UI-Komponenten
    ├── fixtures/         ← Typisierte Testdaten
    └── lib/
        ├── queryClient.ts
        ├── queryKeys.ts
        ├── dates.ts
        └── errors.ts
```

## Datei-Größe

250–300 LOC pro Datei. Hard limit ~350. Feature-Dateien aufteilen wenn nötig.

## KISS über DRY

Lieber JSX duplizieren als eine fragwürdige Abstraktion bauen.

## Props: Nie Destructuren

```tsx
// FALSCH
function EntryCard({ title, date, status }: Props) { ... }

// RICHTIG
function EntryCard(props: Props) {
  return <div>{props.title}</div>
}
```

Man sieht sofort was eine Prop ist und was eine lokale Variable.

## Typen

**Alle Typen kommen aus `src/shared/types.ts`** — immer relativ importieren:

```ts
import type { Entry, EntryFilter } from "../../../../shared/types";
```

Nie eigene Interfaces anlegen die Domain-Objekte beschreiben.
Nie Typen aus `electrobun/view` in Komponenten importieren.

## Stack

| Zweck       | Library                            |
| ----------- | ---------------------------------- |
| Routing     | TanStack Router                    |
| Async State | TanStack Query                     |
| Tabellen    | TanStack Table                     |
| Formulare   | React Hook Form + Zod              |
| UI          | shadcn/ui (Radix Primitives)       |
| Styling     | Tailwind                           |
| Datum       | date-fns-tz, immer `Europe/Berlin` |

## API Layer – Einzige Grenze

Komponenten importieren AUSSCHLIESSLICH aus `src/api/`:

```ts
import { getEntries, createEntry } from "../../api";
```

Nie direkt `electrobun/view` in Features oder Komponenten.

## Error Handling

Jeder API-Call gibt `RpcResponse<T>` zurück:

```ts
const result = await getEntries(filter);
if (result.error) {
  // Fehler anzeigen
  return;
}
// result.data nutzen
```

Nie `.data` ohne vorherige `.error`-Prüfung nutzen.

## React Compiler

- React 19 + Compiler aktiv
- Kein manuelles `useMemo`, `useCallback`, `React.memo` in neuem Code
- Wenn du denkst du brauchst einen: lass den Compiler entscheiden

## Linting / Formatting

```bash
mise run lint   # oxlint + oxfmt, beide müssen sauber sein
```

Nie `// eslint-disable` oder ähnliche Suppression-Kommentare.

## react-doctor

```bash
mise run doctor   # vor jedem Commit
```

## Layout

- Sidebar links, fixed, kein Scrollen
- Content rechts, scrollbar, **volle Breite, linksbündig** (`w-full px-8 py-8`,
  kein `max-w-*`, kein `mx-auto`) — sonst wird bei breiten Tabellen die Hälfte
  abgeschnitten / seitlich gescrollt
- Page-Title im Content-Bereich (nie in der Sidebar)
- Kein Top-Nav

## Events (Bun → Frontend)

```typescript
// src/api/events.ts
export function registerEvents(queryClient: QueryClient) {
  // electroview message handlers sind in real.ts definiert
  // und rufen diese Funktion auf
}
```

Nie Event-Handler in Komponenten registrieren.
