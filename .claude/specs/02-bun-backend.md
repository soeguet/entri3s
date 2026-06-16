# Phase 02 – Bun Backend Core

**Ziel:** Vollständiger Backend-Stack in TypeScript/Bun: Repository, Services, GitLab Client, Worker, Scheduler, Keychain — alles testbar mit `bun test`.

**Voraussetzung:** Phase 01 ✅

**Skills lesen:** `bun-conventions`, `sqlite-patterns`, `gitlab-integration`, `testing-conventions`

---

## 1. Repository Layer

Ein Repository-File pro Domäne. Keine Business Logic. Alle Methoden synchron (bun:sqlite ist synchron).

### Checkliste

- [ ] `repository/entry.ts`: `create`, `update`, `delete`, `getById`, `list(filter)`
- [ ] `repository/ticket.ts`: `upsert`, `getByGitLabIid`, `list`, `markOrphaned`
- [ ] `repository/tag.ts`: `create`, `delete`, `list`
- [ ] `repository/template.ts`: `create`, `update`, `delete`, `list`
- [ ] `repository/event-queue.ts`:
  - `enqueue(type, payload)`
  - `claimNext()` → atomares UPDATE...RETURNING, status=processing
  - `complete(id)`
  - `fail(id, error)` → retries++, bei ≥3 → status=dead
  - `resetStuck()` → processing → pending (beim Start)
  - `listDead()`, `retryDead(id)`
- [ ] `repository/schedule.ts`: `getDue()`, `updateLastRun(name)`
- [ ] `repository/settings.ts`: `get(key)`, `set(key, value)`
- [ ] `repository/index.ts`: `createRepository(db)` gibt alle Repos als Objekt zurück
- [ ] Alle Repo-Funktionen: `null` wenn nicht gefunden, Exception propagieren

**Verify:** `bun build ./src/bun/repository/` kompiliert ohne Fehler

---

## 2. GitLab Client

### Checkliste

- [ ] `gitlab/client.ts`: `createGitLabClient(token, settings)` → `GitLabClient` Interface
- [ ] `gitlab/types.ts`: `GitLabClient` Interface + `FakeGitLabClient` Klasse
- [ ] `gitlab/fetch.ts`: `fetchIssues(projectId, since?)` mit vollständiger Pagination
- [ ] `gitlab/push.ts`: `bookTime(projectId, issueIid, durationMinutes, note)`
- [ ] `gitlab/format.ts`: `formatDuration(minutes): string` → `"1h 30m"` Format
- [ ] Rate Limiter: 5 req/s, `Bun.sleep()` basiert
- [ ] Fehler-Mapping: 401→AUTH_FAILED, 429→RATE_LIMITED, 404→NOT_FOUND, 5xx→GITLAB_ERROR

**Verify:** `bun build ./src/bun/gitlab/` kompiliert ohne Fehler

---

## 3. Service Layer

### Checkliste

**service/entry.ts**

- [ ] `getAll(filter)` — alle Entries mit optionalem Filter
- [ ] `getById(id)`
- [ ] `create(entry)` — prüft Überschneidungen, wirft bei Overlap `{ code: 'OVERLAP' }`
- [ ] `update(entry)`
- [ ] `delete(id)`

Overlap Detection: Zwei Entries überschneiden sich wenn `startA < endB && endA > startB`.
Duration + date definieren Start + Ende. Prüfung im Service, nicht im Repository.

**service/sync.ts**

- [ ] `syncIssues(projectId)`:
  1. `last_run` aus schedules lesen
  2. Issues mit `updated_after` holen (paginated)
  3. Jedes Issue upserten
  4. closed/locked → `markOrphaned`
  5. `updateLastRun('gitlab_sync')`
- [ ] `checkOrphans(projectId)`: nicht mehr zurückgegebene Tickets → orphaned

**service/booking.ts**

- [ ] `bookEntry(entryId)`:
  1. Entry + zugewiesenes Ticket laden
  2. Payload als JSON in event_queue schreiben
  3. Entry status → `'pending_booking'`

**service/index.ts**: `createService(repo, glClient)` gibt alle Services zurück

**Verify:** `bun build ./src/bun/service/` kompiliert ohne Fehler

---

## 4. Worker

`worker/worker.ts` — pollt event_queue, verarbeitet Events.

### Checkliste

- [ ] `startWorker(repo, glClient, win)` → gibt `intervalHandle` zurück
- [ ] Poll alle 5 Sekunden via `setInterval`
- [ ] `claimNext()` → switch auf `event.type`:
  - `'booking'` → payload parsen → `gl.bookTime()` → Entry status → `'booked'`
- [ ] Bei Fehler: `fail(id, error)` aufrufen
- [ ] Nach Verarbeitung: `win.webview.rpc.send.bookingCompleted({})` oder `bookingFailed({ error })`
- [ ] `isProcessing` Flag verhindert parallele Verarbeitung

---

## 5. Scheduler

`scheduler/scheduler.ts`

### Checkliste

- [ ] `startScheduler(repo, svc, win)` → gibt `intervalHandle` zurück
- [ ] Tick alle 60 Sekunden via `setInterval`
- [ ] `getDue()` → fällige Schedules
- [ ] `'gitlab_sync'` → `svc.sync.syncIssues(projectId)`
- [ ] `'orphan_check'` → `svc.sync.checkOrphans(projectId)`
- [ ] Nach Ausführung: `updateLastRun(name)`
- [ ] Sync-Events an Frontend senden: `syncCompleted` / `syncFailed`

---

## 6. Keychain

`keychain/keychain.ts`

### Checkliste

- [ ] `keytar` installieren: `bun add keytar`
- [ ] `setToken(token)`, `getToken()`, `deleteToken()`
- [ ] Service-Name Konstante: `'entries-app'`, Key: `'gitlab_token'`

---

## 7. Tests

### Checkliste

- [ ] `repository/test-helper.ts`: `createTestDb()` mit in-memory SQLite + Migrations
- [ ] `repository/entry.test.ts`: create, getById, list, Overlap-Grenzfälle
- [ ] `repository/event-queue.test.ts`: enqueue → claimNext → complete/fail, resetStuck, dead-letter
- [ ] `service/entry.test.ts`: Overlap Detection
- [ ] `service/sync.test.ts`: FakeGitLabClient, Orphan-Marking, last_run Update
- [ ] `worker/worker.test.ts`: booking Event verarbeitet, FakeGitLabClient.bookTime aufgerufen
- [ ] `gitlab/format.test.ts`: 0min, 30min, 60min, 90min, 120min

**Verify:**

```bash
mise run test-bun   # alle grün
```

---

## Definition of Done

- [ ] `bun build ./src/bun/` kompiliert ohne Fehler
- [ ] `mise run test-bun` grün
- [ ] Keine Typ-Fehler (`bun run tsc --noEmit`)
- [ ] Kein Global State außer `db`
- [ ] Jede Datei unter 350 LOC
- [ ] Worker und Scheduler starten/stoppen über `setInterval`/`clearInterval`

**→ Phase 02 ✅ in PLAN.md setzen, Phase 03 beginnen**
