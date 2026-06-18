---
name: gitlab-integration
description: GitLab API Integration für entries — TypeScript mit fetch(). Verwende diesen Skill für alles unter src/bun/gitlab/: Client-Setup, Rate Limiting, Sync-Logik, Pagination, Buchungen, Zeit-Format.
---

# GitLab Integration – entries (TypeScript)

## Kein SDK — natives fetch()

GitLab hat eine REST API. Wir nutzen Bun's eingebautes `fetch()`.
Kein extra npm-Paket für GitLab nötig.

## Client Struktur

```typescript
// src/bun/gitlab/client.ts
import type { Settings } from "../../shared/types";

export interface GitLabClient {
  fetchIssues(since?: Date): Promise<GitLabIssue[]>; // projektübergreifend (globaler /issues-Endpoint)
  fetchIssue(projectId: number, issueIid: number): Promise<GitLabIssue | null>;
  // Buchungen laufen über GitLab-Timelogs (GraphQL), NICHT über /spend-Kommentare:
  createTimelog(
    target: TimelogTarget, // { projectId, issueIid, issueGlobalId }
    durationMinutes: number,
    spentAt: string, // ISO-Date YYYY-MM-DD
    summary: string, // landet im Summary-Feld der Zeiterfassung, kein Kommentar
  ): Promise<number>; // Timelog-ID
  findTimelog(
    target: TimelogTarget,
    durationMinutes: number,
    spentAt: string,
    summary: string,
  ): Promise<number | null>; // Idempotenz: identischen Timelog finden
  deleteTimelog(timelogId: number): Promise<void>; // Korrektur-Buchungen
}

// getSettings wird pro Request frisch ausgewertet → geänderte gitlabUrl wirkt
// ohne App-Neustart. buildApiUrl validiert das http(s)-Schema (sonst AppError
// NO_GITLAB_URL statt "fetch() URL is invalid").
export function createGitLabClient(token: string, getSettings: () => Settings): GitLabClient {
  const limiter = createRateLimiter(5); // 5 req/s

  async function apiRequest(path: string, options?: RequestInit) {
    await limiter.throttle();
    const res = await fetch(buildApiUrl(getSettings().gitlabUrl, path), {
      ...options,
      headers: {
        "PRIVATE-TOKEN": token,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    if (!res.ok) throw toApiError(res.status, await res.text());
    return res;
  }

  return { fetchIssues, fetchIssue, createTimelog, findTimelog, deleteTimelog };
  // Implementierungen in fetch.ts (REST-Lesen) und timelog.ts (GraphQL-Buchen)
}
```

## Rate Limiter

```typescript
// src/bun/gitlab/client.ts (intern)
function createRateLimiter(reqPerSec: number) {
  let tokens = reqPerSec;
  let lastRefill = Date.now();

  return {
    async throttle() {
      const now = Date.now();
      const elapsed = (now - lastRefill) / 1000;
      tokens = Math.min(reqPerSec, tokens + elapsed * reqPerSec);
      lastRefill = now;
      if (tokens < 1) {
        await Bun.sleep(Math.ceil(1000 / reqPerSec));
        tokens = 0;
      } else {
        tokens--;
      }
    },
  };
}
```

## Interface für Testbarkeit

```typescript
// src/bun/gitlab/types.ts
export interface GitLabClient {
  fetchIssues(since?: Date): Promise<GitLabIssue[]>; // projektübergreifend (globaler /issues-Endpoint)
  fetchIssue(projectId: number, issueIid: number): Promise<GitLabIssue | null>;
  // Buchungen laufen über GitLab-Timelogs (GraphQL), NICHT über /spend-Kommentare:
  createTimelog(
    target: TimelogTarget, // { projectId, issueIid, issueGlobalId }
    durationMinutes: number,
    spentAt: string, // ISO-Date YYYY-MM-DD
    summary: string, // landet im Summary-Feld der Zeiterfassung, kein Kommentar
  ): Promise<number>; // Timelog-ID
  findTimelog(
    target: TimelogTarget,
    durationMinutes: number,
    spentAt: string,
    summary: string,
  ): Promise<number | null>; // Idempotenz: identischen Timelog finden
  deleteTimelog(timelogId: number): Promise<void>; // Korrektur-Buchungen
}

// Fake für Tests (gekürzt — siehe src/bun/gitlab/types.ts)
export class FakeGitLabClient implements GitLabClient {
  createCalls: Array<{ target: TimelogTarget; durationMinutes: number; spentAt: string; summary: string }> = [];
  deleteCalls: number[] = [];
  timelogs: Array<{ /* projectId, issueIid, durationMinutes, spentAt, summary, timelogId */ }> = [];
  issuesToReturn: GitLabIssue[] = [];
  nextTimelogId = 500;

  async createTimelog(target, d, spentAt, summary) {
    const timelogId = this.nextTimelogId++;
    this.createCalls.push({ target, durationMinutes: d, spentAt, summary });
    this.timelogs.push({ ...target, durationMinutes: d, spentAt, summary, timelogId });
    return timelogId;
  }
  async findTimelog(target, d, spentAt, summary) {
    /* identischen Timelog auf projectId+issueIid+dauer+datum+summary suchen */
  }
  async deleteTimelog(timelogId) {
    this.deleteCalls.push(timelogId);
    this.timelogs = this.timelogs.filter((t) => t.timelogId !== timelogId);
  }
}
```

## Projektübergreifend – Iteration über Mitglieds-Projekte

Wir syncen projektübergreifend alle Issues, auf die der Token Zugriff hat. Die
GitLab-**Root**-`issues`-GraphQL-Query taugt dafür NICHT: sie verlangt ein
Pflicht-Filterargument (`"You must provide at least one filter argument for this
query"`) und verbietet so einen unbegrenzten Sync. Stattdessen:

1. `projects(membership: true)` → alle Projekte, in denen der User Mitglied ist
   (Cursor-Pagination).
2. Pro Projekt `project(fullPath:) { issues(...) }` — die **projektgebundene**
   issues-Connection braucht KEIN Filterargument (das Projekt ist der Scope).

Die Projekte werden nach und nach abgearbeitet, gedrosselt über den gemeinsamen
Rate-Limiter (5 req/s) — passend zum Hintergrund-Sync (z. B. 1×/Tag + bei Bedarf),
damit die API nicht überlastet wird. Jedes Issue trägt seine `project_id` (aus dem
Projekt der Schleife injiziert) und seine globale `gitlab_global_id` (aus der
GraphQL-GID), die für `timelogCreate` als `gid://gitlab/Issue/<id>` gebraucht wird.
Es gibt KEINE Projekt-ID in den Settings.

## Hybrid: Sync=GraphQL, Buchungen=GraphQL, Einzel-Issue=REST

Der **Lese-Pfad (Sync)** und der **Schreib-Pfad (Buchungen via Timelogs)** laufen
beide über **GraphQL**. Nur `fetchIssue` (Einzel-Issue) ist noch REST. Alle teilen
sich denselben Rate-Limiter (5 req/s).

| Pfad | Transport | Endpoint | Auth |
| --- | --- | --- | --- |
| Sync (`fetchIssues`) | GraphQL | `POST {base}/api/graphql` | `Authorization: Bearer <token>` |
| Buchen (`createTimelog`/`findTimelog`/`deleteTimelog`) | GraphQL | `POST {base}/api/graphql` | `Authorization: Bearer <token>` |
| `fetchIssue` | REST | `{base}/api/v4/...` | `PRIVATE-TOKEN: <token>` |

Hintergrund/Entscheidung (GraphQL `timelogCreate` statt REST `/spend`): siehe Code-Kommentar in `src/bun/gitlab/timelog.ts`.

## Sync – GraphQL mit Cursor-Pagination (Pflicht)

```typescript
// src/bun/gitlab/graphql.ts — Schritt 1: Mitglieds-Projekte
query($after: String) {
  projects(membership: true, first: 100, after: $after) {
    nodes { id fullPath }
    pageInfo { hasNextPage endCursor }
  }
}

// Schritt 2: Issues je Projekt (projektgebunden, KEIN Pflicht-Filter nötig)
query($fullPath: ID!, $after: String, $since: Time) {
  project(fullPath: $fullPath) {
    issues(first: 100, after: $after, updatedAfter: $since) {
      nodes { id iid title state webUrl updatedAt timeEstimate totalTimeSpent }
      pageInfo { hasNextPage endCursor }
    }
  }
}
```

- Schleife solange `pageInfo.hasNextPage`, jeweils `after: endCursor` mitgeben —
  sowohl für die Projektliste als auch für die Issues je Projekt.
- **Kein `state`-Filter** — wir brauchen auch geschlossene Issues für die
  Orphan-Erkennung.
- `Issue.project { id }` existiert je nach GitLab-Version NICHT — deshalb die
  `project_id` aus dem Projekt der Schleife injizieren (nicht aus dem Issue-Knoten).
- `data.project` kann `null` sein (Projekt nicht erreichbar) → überspringen.
- Mapping GraphQL → `GitLabIssue`: `iid` ist ein String → `Number(...)`;
  `id` (Issue-GID) → `parseGid`; `state` ist bereits lowercase
  (opened/closed/locked); `timeEstimate`/`totalTimeSpent` → `time_stats` (null → 0).
- `since` → GraphQL-Variable `updatedAfter` als ISO-String.

Nie einen List-Endpoint ohne Pagination aufrufen. Stille Datenverluste sonst.

### GraphQL-Fehler (HTTP 200 mit `errors[]`)

GraphQL liefert **HTTP 200 auch bei Fehlern** — der Fehler steckt im
`errors`-Array des Bodys. Nach dem JSON-Parsen: ist `body.errors` ein nicht-leeres
Array → `AppError` mit Code `GITLAB_ERROR` (Message = zusammengeführte
Fehlermeldungen, `retry: false`). Non-ok HTTP-Status weiterhin über `toApiError`.
Diese Logik liegt in `client.ts` `gqlRequest`. GraphQL braucht Token-Scope
`read_api`.

## Inkrementeller Sync

- `last_synced_at` aus `schedules` Table lesen
- `updated_after` Parameter bei allen List-Calls setzen
- Beim ersten Run: `since = 90 Tage zurück`, nicht alles

## Orphan Detection

```typescript
// src/bun/service/sync.ts
export async function syncIssues(repo: Repository, gl: GitLabClient) {
  const schedule = repo.schedules.get("gitlab_sync");
  const since = schedule.lastRun ? new Date(schedule.lastRun) : ninetyDaysAgo();

  const issues = await gl.fetchIssues(since); // projektübergreifend

  for (const issue of issues) {
    repo.tickets.upsert(issue); // projectId kommt aus issue.project_id
    if (issue.state === "closed" || issue.state === "locked") {
      repo.tickets.markOrphaned(issue.iid, issue.project_id);
    }
  }

  repo.schedules.updateLastRun("gitlab_sync");
}
```

## Zeit-Format für Buchungen

```typescript
// src/bun/gitlab/format.ts
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
// 90 min → "1h 30m", 60 min → "1h", 30 min → "0h 30m"

// Gebucht wird IMMER auf die nächste volle Viertelstunde aufgerundet
// (service/booking.ts, beim Bauen des Payloads — der Entry behält seine echte Dauer):
export function roundUpToQuarterHour(minutes: number): number {
  return Math.ceil(minutes / 15) * 15; // 1 → 15, 16 → 30, 90 → 90
}
```

## Buchungsdatum: immer 12:00 UTC

`spentAt` wird als Kalendertag `YYYY-MM-DD` durchgereicht (aus dem Berliner Tag des
Entries, `service/booking.ts`). Beim Senden an `timelogCreate` hängt
`timelog.ts` jedoch `T12:00:00Z` an (`toNoonUtc`): GitLab interpretiert ein reines
Datum als **Mitternacht** und verschob die Buchung über die Zeitzonen-Umrechnung
sonst auf den **Vortag** (z. B. `2026-06-15` → `2026-06-14 22:00 UTC`). Mittags-UTC
liegt in jeder relevanten Zeitzone sicher auf demselben Tag. Der `findTimelog`-
Idempotenz-Lookup nutzt weiter den reinen Tag als `startTime`/`endTime`-Fenster.

## Buchung via Timelog (GraphQL `timelogCreate`)

Wir buchen über **GitLab-Timelogs** (GraphQL `timelogCreate`), **nicht** über die
Notes-/`/spend`-Quick-Action und **nicht** über `add_spent_time` (REST).

**Warum kein `/spend`-Kommentar:** `/spend` legt eine sichtbare Notiz/Kommentar am
Issue an. Das ist unerwünscht — der Buchungstext gehört in die **Zeiterfassung**
("Add time entry → Summary"), nicht in die Kommentarspalte. `timelogCreate`
schreibt genau dorthin und erzeugt KEINEN Kommentar und keine Notification.

```graphql
mutation {
  timelogCreate(input: {
    issuableId: "gid://gitlab/Issue/<globalId>",
    timeSpent: "1h 30m",
    spentAt: "2024-06-17T12:00:00Z",  # Kalendertag auf 12:00 UTC (siehe oben)
    summary: "<Entry-Text>"  # max. 255 Zeichen → summary.slice(0, 255)
  }) { timelog { id } errors }
}
```

- `issuableId` braucht die **globale** Issue-ID (`gid://gitlab/Issue/<globalId>`).
  Die `globalId` wird beim Sync aus der GraphQL-GID gezogen und auf dem Ticket
  gespeichert (`tickets.gitlab_global_id`).
- Response liefert die Timelog-GID (`gid://gitlab/Timelog/<id>`). Wir speichern die
  Zahl als `bookings.gitlab_timelog_id` — Rückreferenz **und** Handle für `deleteTimelog`.

### Korrektur-Buchungen: löschen + neu buchen

Eine Buchung kann storniert werden (`deleteBooking` → Event `booking_delete`):
`deleteTimelog` (`timelogDelete`) entfernt den Timelog in GitLab, der lokale
`bookings`-Record wird gelöscht und der Entry geht zurück auf `draft` → korrigiert
neu buchbar. (Nur der Autor des Timelogs / Maintainer darf löschen.)

### Doppelbuchungs-Schutz (Pflicht)

`timelogCreate` ist **nicht idempotent** — ein Retry nach erfolgreichem API-Call
bucht die Zeit doppelt (Arbeitszeitbetrug). Schutz:

- `handleBooking()` ruft **vor** jedem `createTimelog` `gl.findTimelog(...)` auf:
  Query `timelogs(projectId:, startTime:, endTime:)` und Match auf Issue-iid +
  Dauer + Summary. Existiert ein identischer Timelog → **nicht** erneut buchen,
  nur den lokalen Record rekonziliieren. (Best-effort: scheitert die Query, wird
  trotzdem gebucht — eine etwaige Doppelbuchung lässt sich per `deleteBooking`
  korrigieren.)
- DB-Insert zusätzlich idempotent: `getByTimelogId()` + `UNIQUE(gitlab_timelog_id,
  project_id)`.

## Fehler-Mapping

```typescript
// src/bun/gitlab/client.ts
function toApiError(status: number, body: string): AppError {
  const codes: Record<number, string> = {
    401: "AUTH_FAILED",
    403: "AUTH_FAILED",
    404: "NOT_FOUND",
    429: "RATE_LIMITED",
  };
  return {
    code: codes[status] ?? "GITLAB_ERROR",
    message: body,
    retry: status === 429 || status >= 500,
  };
}
```

## Buchung via Event Queue

Buchungen gehen NIE direkt von service/ zu gitlab/.
Service schreibt in `event_queue`, Worker verarbeitet.

```typescript
// service/booking.ts
export function bookEntry(repo: Repository, entryId: number) {
  const entry = repo.entries.getById(entryId);
  const ticket = repo.tickets.getForEntry(entryId);
  // gitlabGlobalId === null → Ticket muss erst neu gesynct werden (AppError NEEDS_SYNC).
  repo.eventQueue.enqueue("booking", {
    entryId,
    ticketId: ticket.id, // lokal, für bookings-Tabelle
    projectId: ticket.projectId,
    ticketIid: ticket.gitlabIid,
    issueGlobalId: ticket.gitlabGlobalId, // für die GraphQL-GID
    durationMinutes: entry.durationMinutes,
    spentAt: formatInTimeZone(entry.date, "Europe/Berlin", "yyyy-MM-dd"), // Berliner Tag
    note: entry.notes?.trim() ?? "",
  });
  repo.entries.updateStatus(entryId, "pending_booking");
}
```

Nach erfolgreichem `gl.createTimelog()` schreibt der Worker einen `bookings`-Record
mit der zurückgegebenen `gitlab_timelog_id` (Rückverfolgbarkeit pro Buchung). Das
Stornieren läuft über ein eigenes `booking_delete`-Event (siehe oben).
