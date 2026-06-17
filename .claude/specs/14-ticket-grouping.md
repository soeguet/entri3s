# Phase 14 – Ticket-Gruppierung & Filterung (Projekte/Gruppen)

## Problem

Tickets werden flach behandelt. In der DB existiert pro Ticket nur
`project_id` (Integer) – **kein Projektname, kein Pfad, keine Gruppen**. Der
GitLab-Sync holt zwar den `fullPath` jedes Projekts (`graphql.ts`), wirft ihn
aber nach der Iteration weg.

Folgen im UI:

- **`/tickets`**: flache Tabelle, nur Status/State-Filter, keine Projekt-Spalte,
  keine Gruppierung, kein Browsen nach Gruppe/Projekt.
- **EntryForm**: natives `<select>` mit `#<iid> <titel>`. Da `gitlab_iid` nur
  **pro Projekt** eindeutig ist, sind Einträge wie `#1 …` projektübergreifend
  mehrdeutig. Keine Suche, keine Gruppierung.

## Ziel

1. Projekt-Metadaten (inkl. `fullPath`) persistieren → Hierarchie ableitbar.
2. `/tickets`: Baum-Sidebar (Gruppe → Projekt) zum Filtern + Suche, Tabelle nach
   Projekt gruppiert, Projektkontext sichtbar.
3. EntryForm: durchsuchbare, nach Projekt gruppierte Combobox mit
   „zuletzt verwendet"-Sektion. Ersetzt das `<select>`.

Die Gruppenhierarchie wird aus `fullPath` abgeleitet
(`acme/backend/api-service` → Gruppen `acme` › `backend`, Projektblatt
`api-service`). Keine separate `groups`-Tabelle in v1.

## Datenmodell

```sql
-- 006_projects.sql
CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY,   -- GitLab numerische Projekt-ID (= tickets.project_id)
    full_path   TEXT NOT NULL,         -- z.B. "acme/backend/api-service"
    name        TEXT NOT NULL,         -- Anzeigename (Projektblatt)
    synced_at   DATETIME,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

`tickets.project_id` bleibt unverändert (lose Kopplung, kein FK – Tickets können
vor ihrem Projekt gesynct werden; das UI joint clientseitig).

## Typen (`src/shared/types.ts`)

```ts
export interface Project {
  id: number;        // = Ticket.projectId
  fullPath: string;
  name: string;
  syncedAt: string | null;
}
```

RPC: `getProjects` → `Project[]`, `getRecentTickets({limit})` → `Ticket[]`
(aktive Tickets, sortiert nach jüngster Verwendung in Entries).

## Backend

- `gitlab/types.ts`: `GitLabProject {id, fullPath, name}`, `fetchProjects()` am
  `GitLabClient` + `FakeGitLabClient`.
- `gitlab/graphql.ts`: `name` in `PROJECTS_QUERY`, `fetchProjects()` exportieren.
- `repository/project.ts`: `upsert`, `list`, `getById`.
- `repository/ticket.ts`: `listRecent(limit)` (Join `entry_tickets`/`entries`,
  `ORDER BY MAX(e.updated_at) DESC`).
- `service/project.ts`: `getAll()`; `service/ticket.ts`: `getRecent(limit)`.
- `service/sync.ts`: vor dem Issue-Sync `gl.fetchProjects()` → `projects.upsert`.

## Frontend

- `lib/projectTree.ts` (pure, getestet): `buildProjectTree(projects, counts)`,
  `collectProjectIds(node)`.
- `features/entries/TicketCombobox.tsx`: Suche + Gruppierung nach Projekt +
  „zuletzt verwendet", Tastaturnavigation. Ersetzt das `<select>` im EntryForm.
- `features/tickets/TicketTree.tsx` + `TicketsPage.tsx`: Baum-Filter, Suche,
  nach Projekt gruppierte Tabelle, Projektname statt nur IID.

## Tests

- `repository/project.test.ts`, `lib/projectTree.test.ts`,
  `graphql.test.ts` (fetchProjects), `sync.test.ts` (Projekte persistiert),
  `TicketCombobox.test.tsx` (Render/Auswahl).
