---
name: gitlab-integration
description: GitLab API Integration für entries — TypeScript mit fetch(). Verwende diesen Skill für alles unter src/bun/gitlab/: Client-Setup, Rate Limiting, Sync-Logik, Pagination, Buchungen, Zeit-Format.
---

# GitLab Integration – entries (TypeScript)

Kein SDK, kein GitLab-npm-Paket: natives Bun `fetch()`. Lesen läuft über GraphQL
(Sync) bzw. REST (Einzel-Issue), Schreiben (Buchungen) über GraphQL-Timelogs.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `client.ts` | `createGitLabClient`, Rate-Limiter, `apiRequest`/`gqlRequest`, Fehler-Mapping, URL-Validierung |
| `graphql.ts` | Sync-Lesepfad: `fetchProjects` + `fetchIssues` (Pagination, Mapping) |
| `fetch.ts` | `fetchIssue` (Einzel-Issue, REST) |
| `timelog.ts` | `createTimelog`/`findTimelog`/`deleteTimelog` (GraphQL-Mutationen) |
| `format.ts` | `formatDuration`, `roundUpToQuarterHour` |
| `types.ts` | `GitLabClient`-Interface, Domain-Typen, `FakeGitLabClient` (Test-Double) |

Das `GitLabClient`-Interface und `FakeGitLabClient` leben in `types.ts` — dort
nachschlagen, nicht hier duplizieren. Typen kommen aus `types.ts`/`shared/types.ts`,
nie separat definieren.

## Transport-Übersicht

| Pfad | Transport | Endpoint | Auth |
| --- | --- | --- | --- |
| `fetchProjects`, `fetchIssues` (Sync) | GraphQL | `POST {base}/api/graphql` | `Authorization: Bearer <token>` |
| `createTimelog`/`findTimelog`/`deleteTimelog` (Buchen) | GraphQL | `POST {base}/api/graphql` | `Authorization: Bearer <token>` |
| `fetchIssue` (Einzel-Issue) | REST | `{base}/api/v4/...` | `PRIVATE-TOKEN: <token>` |

- **Rate-Limiter 5 req/s, eine Instanz, SHARED** über REST und GraphQL (Token-Bucket
  in `client.ts createRateLimiter`, vor jedem Call `await limiter.throttle()`).
- `getSettings()` wird pro Request frisch ausgewertet → geänderte `gitlabUrl` wirkt
  ohne App-Neustart. `validatedBase` erzwingt `http(s)`-Schema, sonst `AppError`
  `NO_GITLAB_URL` (statt rohem "fetch URL is invalid").
- GraphQL-Token braucht Scope **`read_api`**.

## GraphQL-Fehler: HTTP 200 mit `errors[]` (Pflicht-Check)

GraphQL liefert **HTTP 200 auch bei Fehlern** — der Fehler steckt im `errors`-Array
des Bodys. `gqlRequest` muss nach dem JSON-Parsen prüfen: ist `body.errors` ein
nicht-leeres Array → `AppError` Code `GITLAB_ERROR` (Message = gejointe Messages,
`retry: false`). Non-ok HTTP-Status weiterhin über `toApiError` (siehe `client.ts`).

## Sync – projektübergreifend, GraphQL, Pagination (Pflicht)

Wir syncen alle Issues, auf die der Token Zugriff hat. Die GitLab-**Root**-`issues`-
Query taugt dafür NICHT: sie verlangt ein Pflicht-Filterargument ("You must provide
at least one filter argument for this query") und verbietet so einen unbegrenzten
Sync. Stattdessen zweistufig:

1. `projects(membership: true, first: 100, after:)` → alle Mitglieds-Projekte
   (Cursor-Pagination).
2. Pro Projekt `project(fullPath:) { issues(first: 100, after:, updatedAfter:) }` —
   die **projektgebundene** issues-Connection braucht KEIN Filterargument.

```graphql
project(fullPath: $fullPath) {
  issues(first: 100, after: $after, updatedAfter: $since) {
    nodes { id iid title state webUrl updatedAt timeEstimate totalTimeSpent }
    pageInfo { hasNextPage endCursor }
  }
}
```

Regeln (siehe `graphql.ts`):

- **Pagination ist Pflicht** — Schleife solange `pageInfo.hasNextPage`, jeweils
  `after: endCursor`. Gilt für Projektliste UND Issues je Projekt. Nie einen
  List-Endpoint ohne Pagination aufrufen → sonst stille Datenverluste.
- **Kein `state`-Filter** — der Sync braucht auch geschlossene Issues für die
  Orphan-Erkennung (sonst entstehen Orphans falsch).
- **`project_id` aus der Schleife injizieren**, nicht aus dem Issue-Knoten:
  `Issue.project { id }` existiert je nach GitLab-Version nicht.
- `data.project` kann `null` sein (Projekt nicht erreichbar) → überspringen.
- Mapping → `GitLabIssue`: `iid` ist String → `Number()`; `id` (GID) → `parseGid`
  (trailing Integer); `state` ist bereits lowercase (opened/closed/locked);
  `timeEstimate`/`totalTimeSpent` → `time_stats` (null → 0). Die GID-Zahl wird als
  `globalId` gespeichert — gebraucht für `timelogCreate`.
- `since` → GraphQL-Variable `updatedAfter` als ISO-String.

### Inkrementeller Sync & Orphans

`syncIssues` (`service/sync.ts`) liest `lastRun` aus `schedules` (`gitlab_sync`);
fehlt er, ist `since = ninetyDaysAgo()` (nicht alles). Ablauf: erst
`gl.fetchProjects()` → `repo.projects.upsert` (Frontend leitet daraus den
Gruppenbaum ab), dann `gl.fetchIssues(since)` → pro Issue `tickets.upsert`; bei
`closed`/`locked` → `markOrphaned`, sonst → `markActive` (wieder geöffnete Tickets
reaktivieren). Am Ende `schedules.updateLastRun`. `checkOrphans` macht den
Vollabgleich gegen die aktuell offen gemeldeten Issues.

## Buchung via Timelog (GraphQL `timelogCreate`)

Wir buchen über **GitLab-Timelogs** (`timelogCreate`), **nicht** über `/spend`
(Quick-Action) und **nicht** über `add_spent_time` (REST).

**Warum kein `/spend`:** `/spend` erzeugt eine sichtbare Notiz/Kommentar am Issue.
Der Buchungstext gehört aber in die Zeiterfassung ("Add time entry → Summary"),
nicht in die Kommentarspalte. `timelogCreate` schreibt genau dorthin — KEIN
Kommentar, keine Notification. (Hintergrund als Kommentar in `timelog.ts`.)

```graphql
mutation($issuableId: IssuableID!, $timeSpent: String!, $spentAt: Time, $summary: String!) {
  timelogCreate(input: { issuableId: $issuableId, timeSpent: $timeSpent, spentAt: $spentAt, summary: $summary }) {
    timelog { id }
    errors
  }
}
```

- `issuableId` braucht die **globale** Issue-ID als `gid://gitlab/Issue/<globalId>`
  (beim Sync aus der GID gezogen, auf dem Ticket als `gitlab_global_id` gespeichert).
- Response liefert die Timelog-GID; wir speichern die Zahl als
  `bookings.gitlab_timelog_id` — Rückreferenz UND Handle für `deleteTimelog`.
- `summary` wird bei 255 Zeichen gekappt (`MAX_SUMMARY_LENGTH`, `truncate`).
- `timelogCreate.errors` zusätzlich prüfen (feldspezifisch), nicht nur Top-Level.

### Buchungsdatum: immer 12:00 UTC (`toNoonUtc`)

`spentAt` kommt als Kalendertag `YYYY-MM-DD` (Berliner Tag des Entries). Vor dem
Senden hängt `timelog.ts toNoonUtc` `T12:00:00Z` an: GitLab interpretiert ein
reines Datum als **Mitternacht** und verschob die Buchung über die Zeitzonen-
Umrechnung sonst auf den **Vortag** (z. B. `2026-06-15` → `2026-06-14 22:00 UTC`).
Mittags-UTC liegt in jeder relevanten Zeitzone sicher auf demselben Tag. Der
`findTimelog`-Lookup nutzt weiter den reinen Tag als `startTime`/`endTime`-Fenster.

### Aufrunden auf 15-Minuten-Raster

`roundUpToQuarterHour` (`format.ts`) rundet die zu buchende Dauer IMMER auf die
nächste volle Viertelstunde auf (1→15, 16→30, 90→90). Der Entry behält seine echte
Dauer; nur der Buchungs-Payload wird aufgerundet. `formatDuration` macht daraus das
GitLab-Format (90 → "1h 30m", 60 → "1h", 0 → "0h").

### Doppelbuchungs-Schutz (Pflicht, best-effort)

`timelogCreate` ist **nicht idempotent** — ein Retry nach erfolgreichem API-Call
bucht doppelt (Arbeitszeitbetrug). Schutz: **vor** jedem `createTimelog`
`gl.findTimelog(...)` aufrufen — Query `timelogs(projectId:, startTime:, endTime:)`
über das Tagesfenster, Match auf Issue-`iid` + Dauer (Sekunden) + Summary. Treffer →
nicht erneut buchen, nur lokalen Record rekonziliieren. **Best-effort:** scheitert
die Query, wird trotzdem gebucht (eine Doppelbuchung lässt sich per `deleteBooking`
korrigieren). Zusätzlich DB-seitig idempotent über
`UNIQUE(gitlab_timelog_id, project_id)`.

### Korrektur-Buchungen: löschen + neu

Stornieren läuft über ein eigenes `booking_delete`-Event: `deleteTimelog`
(`timelogDelete`) entfernt den Timelog, der lokale `bookings`-Record wird gelöscht,
der Entry geht zurück auf `draft`. Einen bereits extern gelöschten Timelog meldet
GitLab als **Top-Level**-GraphQL-Error (Exception aus `gqlRequest`), nicht im
`timelogDelete.errors`-Feld — `deleteTimelog` toleriert BEIDE Pfade über
`isAlreadyGone`, sonst bliebe der Record hängen / liefe ins Dead-Letter.

## Buchung via Event Queue

Buchungen gehen NIE direkt von `service/` zu `gitlab/`. Service schreibt in
`event_queue`, der Worker verarbeitet. `bookEntry` (`service/booking.ts`) enqueued
ein `booking`-Event mit `issueGlobalId`, `projectId`, `ticketIid`, `durationMinutes`
und `spentAt` (Berliner Tag via `formatInTimeZone(..., "Europe/Berlin", "yyyy-MM-dd")`);
ist `gitlabGlobalId === null`, erst neu syncen (`AppError NEEDS_SYNC`). Entry geht auf
`pending_booking`. Nach erfolgreichem `gl.createTimelog()` schreibt der Worker den
`bookings`-Record mit der zurückgegebenen `gitlab_timelog_id`.

## Fehler-Codes (`toApiError`, `client.ts`)

401/403 → `AUTH_FAILED`, 404 → `NOT_FOUND`, 429 → `RATE_LIMITED`, sonst
`GITLAB_ERROR`. `retry: true` bei 429 und ≥500. Netzwerkfehler (DNS/TLS/Timeout) →
`NETWORK_ERROR` (`retry: true`) statt roher "fetch failed"-Exception. Über RPC immer
`AppError`, nie rohe Exceptions.
