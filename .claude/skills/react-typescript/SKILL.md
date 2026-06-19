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

Datei-Größe und KISS-über-DRY gelten wie projektweit (CLAUDE.md); Feature-Dateien
aufteilen statt eine fragwürdige Abstraktion zu bauen, lieber JSX duplizieren.

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

## Linting / doctor

`mise run lint` (oxfmt+oxlint, beide sauber) und `mise run doctor` (react-doctor,
vor jedem Commit). Nie `// eslint-disable` oder ähnliche Suppression-Kommentare.

## Layout

- Sidebar links, fixed, kein Scrollen
- Content rechts, scrollbar, **volle Breite, linksbündig** (`w-full px-8 py-8`,
  kein `max-w-*`, kein `mx-auto`) — sonst wird bei breiten Tabellen die Hälfte
  abgeschnitten / seitlich gescrollt
- Page-Title im Content-Bereich (nie in der Sidebar)
- Kein Top-Nav

## Farben / Status-Tokens

**Nie rohe Tailwind-Farbklassen** (`slate-*`, `red-700`, `amber-50`,
`dark:bg-*` …). Sie brechen den Dark Mode und die WCAG-Kontraste. Es gibt nur
semantische Tokens (in `index.css` als CSS-Variablen, in `tailwind.config.js`
gemappt) — sie reagieren automatisch auf hell/dunkel, kein `dark:`-Prefix nötig.

Neutral / Flächen:

- `bg-background`, `text-foreground`, `bg-card`, `bg-muted`,
  `text-muted-foreground`, `border-border`, `border-input`, `bg-primary` /
  `text-primary-foreground`, `ring-ring`.

Status (Banner, Badges, Toasts, Inline-Text, Buttons/Indikatoren):

| Zustand | weiche Fläche | Rahmen | Text/Icon | solider Button | Text auf solid |
| ------- | ------------- | ------ | --------- | -------------- | -------------- |
| success | `bg-success-surface` | `border-success-border` | `text-success-accent` | `bg-success-solid` | `text-success-solid-foreground` |
| warning | `bg-warning-surface` | `border-warning-border` | `text-warning-accent` | `bg-warning-solid` | `text-warning-solid-foreground` |
| danger  | `bg-danger-surface`  | `border-danger-border`  | `text-danger-accent`  | `bg-danger-solid`  | `text-danger-solid-foreground`  |
| info    | `bg-info-surface`    | `border-info-border`    | `text-info-accent` (Links) | – | – |

Hover auf soliden Buttons: `hover:bg-<status>-solid/90` (wie `bg-primary/90`).
Neuer Status/Farbe nötig? Erst Token in `index.css` **und** `tailwind.config.js`
anlegen, dann verwenden — nicht inline hardcoden.

## Events (Bun → Frontend)

Push-Events (Sync/Buchung fertig etc.) kommen als electroview **message handlers**,
definiert ausschließlich im `defineRPC`-Block in `src/api/real.ts`. Sie
invalidieren bzw. setzen die betroffenen Query-Keys (`queryClient`) und zeigen ggf.
einen Toast. Nie Event-Handler in Komponenten registrieren.
