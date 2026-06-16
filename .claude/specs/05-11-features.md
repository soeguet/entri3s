# Phase 05–11 – Features & Testing

---

# Phase 05 – Feature: Entries

**Voraussetzung:** Phase 04 ✅ · **Skills:** `react-typescript`, `testing-conventions`

## Checkliste

**Route `/entries` – Liste**

- [ ] TanStack Table: Spalten Datum, Titel, Dauer, Ticket(s), Status, Aktionen
- [ ] Filter: Datumsbereich, Status
- [ ] Sortierung: Datum, Dauer
- [ ] Status-Badge (`draft`, `pending_booking`, `booked`, `orphaned`)
- [ ] "Neuer Entry"-Button → Formular

**Entry Form (Create + Edit)**

- [ ] React Hook Form + Zod Schema
- [ ] Felder: Titel, Datum, Startzeit, Endzeit (Dauer berechnet), Notizen, Tags (Multi-Select), Ticket (Single-Select)
- [ ] Zod: Titel required, Ende nach Start
- [ ] Overlap-Fehler (`code: 'OVERLAP'`) → Inline-Fehler, kein Toast
- [ ] Submit → `api.createEntry` / `api.updateEntry` → `queryClient.invalidateQueries(keys.entries())`

**Tests**

- [ ] `EntryList.test.tsx`: rendert, Filter funktioniert
- [ ] `EntryForm.test.tsx`: Validierung, Overlap-Fehler sichtbar

**Verify:** `mise run test-fe` grün · `mise run lint` grün

## Definition of Done

- [ ] Entry CRUD End-to-End (Mock + Electrobun)
- [ ] Overlap korrekt abgefangen und angezeigt
- [ ] Keine manuellen TypeScript-Interfaces

---

# Phase 06 – Feature: GitLab Sync

**Voraussetzung:** Phase 05 ✅ · **Skills:** `gitlab-integration`

## Checkliste

**Go-seitig (bereits Phase 02 — hier: Integration)**

- [ ] `triggerSync` RPC-Handler verdrahtet mit `svc.sync.syncIssues`
- [ ] Sync sendet korrekt `syncCompleted` / `syncFailed` Events
- [ ] Orphan Detection markiert Tickets mit `status='orphaned'`

**Frontend**

- [ ] "Sync"-Button (Settings oder Sidebar)
- [ ] Während Sync: Button disabled + Spinner
- [ ] Nach `syncCompleted`: Ticket-Liste automatisch aktualisiert (Event → invalidateQueries)
- [ ] Orphaned Tickets in Liste mit Badge "Archiviert"
- [ ] `syncFailed` → sichtbare Fehlermeldung

**Tests (Bun)**

- [ ] `service/sync.test.ts`: FakeGitLabClient gibt Issues zurück, Orphan wird markiert, `last_run` aktualisiert

**Verify:** `mise run test-bun` grün

## Definition of Done

- [ ] Manueller Sync holt Issues, Ticket-Liste aktualisiert sich
- [ ] Geschlossene Issues → orphaned
- [ ] Scheduler triggert Sync (testbar über `schedules` Table)

---

# Phase 07 – Feature: Booking

**Voraussetzung:** Phase 06 ✅

## Checkliste

**Backend (Worker in Phase 02 — hier: Integration)**

- [ ] `bookEntry` RPC-Handler → `svc.booking.bookEntry`
- [ ] Worker verarbeitet `'booking'` Events → `gl.bookTime` → Entry status `'booked'`
- [ ] 3 Fehler → `status='dead'`, `bookingFailed` Event

**Frontend**

- [ ] "Buchen"-Button in Entry-Liste (nur wenn Ticket zugewiesen)
- [ ] Entry-Status sichtbar: draft / pending_booking / booked
- [ ] Fehlgeschlagene Buchungen: eigener Bereich (Route oder Settings-Abschnitt)
  - [ ] Liste der dead Events mit Fehlermeldung
  - [ ] "Erneut versuchen"-Button → `api.retryDeadEvent(id)`
- [ ] Nach `bookingCompleted` / `bookingFailed`: Entry-Liste + Dead-Events aktualisieren

**Tests**

- [ ] `worker/worker.test.ts`: Event verarbeitet, FakeGitLabClient.bookTime aufgerufen
- [ ] Retry-Logik: retries inkrementiert, bei ≥3 → dead

**Verify:** `mise run test` grün

## Definition of Done

- [ ] Booking End-to-End: Entry → Buchen → pending → booked
- [ ] Fehlgeschlagene Buchungen sichtbar + retriggerable
- [ ] Kein Datenverlust bei App-Neustart (resetStuck auf startup)

---

# Phase 08 – Feature: Tickets

**Voraussetzung:** Phase 06 ✅

## Checkliste

- [ ] Route `/tickets`: TanStack Table
  - Spalten: IID, Titel, Status, GitLab-State, Zeit-Estimate, Zeit-gebucht
  - Filter: Status (active/orphaned), State (opened/closed)
  - Link zu GitLab (`web_url`) als externer Link
- [ ] Ticket-Zuweisung im Entry-Form: Dropdown aus aktiven Tickets
- [ ] Orphaned Tickets visuell unterscheidbar (Badge, gedimmt)
- [ ] Kein Erstellen/Editieren von Tickets — nur via Sync

## Definition of Done

- [ ] Ticket-Liste mit Sync-Status
- [ ] Zuweisung zu Entry funktioniert
- [ ] Orphaned Tickets erkennbar

---

# Phase 09 – Feature: Management

**Voraussetzung:** Phase 05 ✅

## Checkliste

**Tags**

- [ ] Route `/management`: Tags-Sektion
- [ ] Tag erstellen (Name + Farbe, einfache Palette)
- [ ] Tag löschen (mit Bestätigung)

**Templates**

- [ ] Templates-Sektion
- [ ] Template erstellen: Name + Entry-Felder vorbefüllen
- [ ] Template anwenden: Entry-Form mit Template-Werten befüllen
- [ ] Template bearbeiten, löschen

## Definition of Done

- [ ] Tags: CRUD, in Entry-Form nutzbar
- [ ] Templates: erstellen, anwenden, löschen

---

# Phase 10 – Feature: Settings

**Voraussetzung:** Phase 07 ✅

## Checkliste

**Route `/settings`**

- [ ] GitLab URL → `settings` Table via `api.saveSettings`
- [ ] GitLab Token → OS Keychain via `api.setGitLabToken` (Password Input, nie plaintext anzeigen)
- [ ] Project ID → `settings` Table
- [ ] Sync-Intervall in Minuten → `schedules` Table (via saveSettings)
- [ ] "Datenbank sichern"-Button → Datei-Dialog → `api.backupDatabase(path)`
- [ ] App-Version im Settings-Panel

**Backend**

- [ ] `saveSettings` schreibt GitLab URL + Project ID + Sync-Intervall
- [ ] `setGitLabToken` → `keychain.setToken(token)`
- [ ] `getSettings` liest Settings + Sync-Intervall aus schedules
- [ ] `backupDatabase(destPath)` → `VACUUM INTO` (aus sqlite-patterns Skill)

## Definition of Done

- [ ] Credentials im OS Keychain, nie in SQLite
- [ ] Backup erstellt valide SQLite-Kopie
- [ ] Sync-Intervall konfigurierbar

---

# Phase 11 – Testing & Hardening

**Voraussetzung:** Phase 10 ✅ (läuft parallel ab Phase 02)

**Skills:** `testing-conventions`

## Checkliste

**Bun Tests – Vollständigkeit**

- [ ] `repository/*.test.ts`: alle CRUD-Methoden, Grenzfälle
- [ ] `repository/event-queue.test.ts`: enqueue → claim → complete/fail, dead-letter, resetStuck
- [ ] `service/entry.test.ts`: Overlap-Grenzfälle (exakt gleiche Zeit, 1min Überlapp, kein Überlapp)
- [ ] `service/sync.test.ts`: inkrementell, orphan
- [ ] `worker/worker.test.ts`: Retry, Dead-Letter
- [ ] `gitlab/format.test.ts`: 0, 30, 60, 90, 120 Minuten

**Frontend Tests – Vollständigkeit**

- [ ] `EntryList.test.tsx`, `EntryForm.test.tsx`
- [ ] `BookingStatus.test.tsx`: dead Events, Retry-Button
- [ ] Mindestens 1 Test pro Feature-Komponente

**Qualität**

- [ ] `mise run test` grün
- [ ] `mise run lint` grün (oxlint + oxfmt)
- [ ] `mise run doctor` grün (react-doctor)
- [ ] `bun run tsc --noEmit` — keine Typ-Fehler

**Stabilität**

- [ ] App-Neustart mit pending Booking: Entry bleibt pending, Worker verarbeitet weiter
- [ ] `PRAGMA journal_mode` gibt `wal` zurück
- [ ] Kein `database is locked` Fehler

**Verify:**

```bash
mise run test
mise run lint
mise run doctor
```

## Definition of Done

- [ ] Alle Tests grün
- [ ] Lint sauber
- [ ] Kein bekannter Absturz-Pfad
- [ ] PLAN.md: alle Phasen ✅

**→ entries v2 fertig**
