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
  bookTime(
    projectId: number,
    issueIid: number,
    durationMinutes: number,
    spentAt: string, // ISO-Date YYYY-MM-DD
    note: string,
    marker: string, // Idempotenz-Marker im Note-Body
  ): Promise<GitLabBookingResult>; // { noteId, createdAt }
  findBookingNote(
    projectId: number,
    issueIid: number,
    marker: string,
  ): Promise<GitLabBookingResult | null>;
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

  return { fetchIssues, fetchIssue, bookTime };
  // Implementierungen in fetch.ts und push.ts
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
  bookTime(
    projectId: number,
    issueIid: number,
    durationMinutes: number,
    spentAt: string, // ISO-Date YYYY-MM-DD
    note: string,
    marker: string, // Idempotenz-Marker im Note-Body
  ): Promise<GitLabBookingResult>; // { noteId, createdAt }
  findBookingNote(
    projectId: number,
    issueIid: number,
    marker: string,
  ): Promise<GitLabBookingResult | null>;
}

// Fake für Tests
export class FakeGitLabClient implements GitLabClient {
  bookedCalls: Array<{
    projectId: number;
    issueIid: number;
    durationMinutes: number;
    spentAt: string;
    note: string;
  }> = [];
  issuesToReturn: GitLabIssue[] = [];
  nextNoteId = 500;

  async fetchIssues() {
    return this.issuesToReturn;
  }
  async fetchIssue() {
    return this.issuesToReturn[0] ?? null;
  }
  async bookTime(p, i, d, spentAt, note, marker) {
    const noteId = this.nextNoteId++;
    this.bookedCalls.push({ projectId: p, issueIid: i, durationMinutes: d, spentAt, note, marker });
    this.notes.push({ projectId: p, issueIid: i, marker, noteId });
    return { noteId, createdAt: "2024-01-15T10:00:00.000Z" };
  }
  async findBookingNote(p, i, marker) {
    const n = this.notes.find((x) => x.projectId === p && x.issueIid === i && x.marker === marker);
    return n ? { noteId: n.noteId, createdAt: "2024-01-15T10:00:00.000Z" } : null;
  }
}
```

## Projektübergreifend – globaler /issues-Endpoint

Wir syncen NICHT pro Projekt (`/projects/:id/issues`), sondern projektübergreifend
über den globalen Endpoint `GET /api/v4/issues?scope=all` — er liefert alle Issues,
auf die der Token Zugriff hat. Jedes Issue trägt seine `project_id`, über die der
Sync die Tickets weiterhin pro Projekt zuordnet. Es gibt KEINE Projekt-ID in den
Settings. Buchungen (`bookTime`/`findBookingNote`) bleiben per-Projekt, weil die
Notes-API projektgebunden ist — die `projectId` stammt dann aus dem Ticket-Row.

## Pagination – Pflicht

```typescript
// src/bun/gitlab/fetch.ts
export async function fetchIssues(
  client: { apiRequest: Function },
  since?: Date,
): Promise<GitLabIssue[]> {
  const all: GitLabIssue[] = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      scope: "all",
      per_page: "100",
      page: String(page),
      ...(since ? { updated_after: since.toISOString() } : {}),
    });
    const res = await client.apiRequest(`/issues?${params}`);
    const issues: GitLabIssue[] = await res.json();
    all.push(...issues);

    const totalPages = Number(res.headers.get("x-total-pages") ?? 1);
    if (page >= totalPages) break;
    page++;
  }

  return all;
}
```

Nie einen List-Endpoint ohne Pagination aufrufen. Stille Datenverluste sonst.

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
```

## Buchung via Notes-API (`/spend` Quick Action)

Wir buchen **nicht** über `add_spent_time` (REST), weil das immer `Date.now()`
als Datum setzt. Stattdessen die Notes-API mit der `/spend` Quick Action — die
akzeptiert ein frei wählbares Buchungsdatum.

```
POST /api/v4/projects/:projectId/issues/:issueIid/notes
{ "body": "/spend 1h 30m 2024-06-17\n\n<Entry-Text>" }
```

- **Datum** im Body als reines ISO-Date (`YYYY-MM-DD`), ohne Uhrzeit
  (`/spend` ignoriert Uhrzeiten — GitLab-Limitierung).
- **Entry-Text** wird unter die Quick Action gehängt, damit die Notiz auf dem
  Ticket sichtbar bleibt. GitLab kappt bei **255 Zeichen** → `note.slice(0, 255)`.
- Ohne Text entsteht eine reine System-Note (keine Notification).
- Response liefert `{ id, created_at }` — `id` ist die `gitlab_note_id`, unsere
  Rückreferenz für die `bookings`-Tabelle. Link: `{ticket.webUrl}#note_{id}`.

### Doppelbuchungs-Schutz (Pflicht)

`/spend` ist **additiv und nicht idempotent** — ein Retry nach erfolgreichem
API-Call bucht die Zeit doppelt (Arbeitszeitbetrug). Schutz:

- Jeder Note wird ein unsichtbarer Marker mitgegeben:
  `bookingMarker(entryId)` → `<!-- entries-booking:entry=<id> -->` (HTML-Kommentar,
  in GitLab nicht gerendert).
- `handleBooking()` ruft **vor** jedem `/spend` `gl.findBookingNote(projectId,
  issueIid, marker)` auf. Existiert die Note schon → **nicht** erneut buchen,
  nur den lokalen Record rekonziliieren.
- DB-Insert zusätzlich idempotent: `getByNoteId()` + `UNIQUE(gitlab_note_id,
  project_id)`.

Nie `/spend` ohne diesen Vorab-Check buchen.

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
  repo.eventQueue.enqueue("booking", {
    entryId,
    ticketId: ticket.id, // lokal, für bookings-Tabelle
    projectId: ticket.projectId,
    ticketIid: ticket.gitlabIid,
    durationMinutes: entry.durationMinutes,
    spentAt: formatInTimeZone(entry.date, "Europe/Berlin", "yyyy-MM-dd"), // Berliner Tag
    note: entry.notes ? `${entry.title}\n${entry.notes}` : entry.title,
  });
  repo.entries.updateStatus(entryId, "pending_booking");
}
```

Nach erfolgreichem `gl.bookTime()` schreibt der Worker einen `bookings`-Record
mit der zurückgegebenen `gitlab_note_id` (Rückverfolgbarkeit pro Buchung).
