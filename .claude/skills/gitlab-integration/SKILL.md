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
  fetchIssues(projectId: number, since?: Date): Promise<GitLabIssue[]>;
  fetchIssue(projectId: number, issueIid: number): Promise<GitLabIssue | null>;
  bookTime(
    projectId: number,
    issueIid: number,
    durationMinutes: number,
    note: string,
  ): Promise<void>;
}

export function createGitLabClient(token: string, settings: Settings): GitLabClient {
  const limiter = createRateLimiter(5); // 5 req/s

  async function apiRequest(path: string, options?: RequestInit) {
    await limiter.throttle();
    const res = await fetch(`${settings.gitlabUrl}/api/v4${path}`, {
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
  fetchIssues(projectId: number, since?: Date): Promise<GitLabIssue[]>;
  fetchIssue(projectId: number, issueIid: number): Promise<GitLabIssue | null>;
  bookTime(
    projectId: number,
    issueIid: number,
    durationMinutes: number,
    note: string,
  ): Promise<void>;
}

// Fake für Tests
export class FakeGitLabClient implements GitLabClient {
  bookedCalls: Array<{ projectId: number; issueIid: number; durationMinutes: number }> = [];
  issuesToReturn: GitLabIssue[] = [];

  async fetchIssues() {
    return this.issuesToReturn;
  }
  async fetchIssue() {
    return this.issuesToReturn[0] ?? null;
  }
  async bookTime(p, i, d) {
    this.bookedCalls.push({ projectId: p, issueIid: i, durationMinutes: d });
  }
}
```

## Pagination – Pflicht

```typescript
// src/bun/gitlab/fetch.ts
export async function fetchIssues(
  client: { apiRequest: Function },
  projectId: number,
  since?: Date,
): Promise<GitLabIssue[]> {
  const all: GitLabIssue[] = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      per_page: "100",
      page: String(page),
      ...(since ? { updated_after: since.toISOString() } : {}),
    });
    const res = await client.apiRequest(`/projects/${projectId}/issues?${params}`);
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
export async function syncIssues(repo: Repository, gl: GitLabClient, projectId: number) {
  const schedule = repo.schedules.get("gitlab_sync");
  const since = schedule.lastRun ? new Date(schedule.lastRun) : ninetyDaysAgo();

  const issues = await gl.fetchIssues(projectId, since);

  for (const issue of issues) {
    repo.tickets.upsert(issue);
    if (issue.state === "closed" || issue.state === "locked") {
      repo.tickets.markOrphaned(issue.iid, projectId);
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

Buchungs-Body: `{ spent_at: date, duration: "1h 30m" }`

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
  repo.eventQueue.enqueue("booking", { entryId, ticketIid: ticket.gitlabIid });
  repo.entries.updateStatus(entryId, "pending_booking");
}
```
