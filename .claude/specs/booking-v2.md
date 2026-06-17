# Booking v2 – GitLab Notes API + Booking-Tracking

**Ziel:** Buchungen über die GitLab Notes API (`/spend` Quick Action) statt REST `add_spent_time`, mit vollständiger Rückverfolgbarkeit pro Buchung in einer eigenen `bookings`-Tabelle.

**Voraussetzung:** Phase 07 (Booking) ✅

**Skills lesen:** `gitlab-integration`, `bun-conventions`, `sqlite-patterns`, `testing-conventions`

---

## Motivation

1. **`add_spent_time` (REST)** setzt kein Datum — GitLab nimmt immer `Date.now()`. Wer abends für den ganzen Tag bucht, hat alle Einträge auf 18:00 statt auf die tatsächlichen Uhrzeiten.
2. **Notes API** mit `/spend 2h 2024-06-17` erlaubt ein frei wählbares Datum. Über die REST v4 Notes-API (`POST /projects/:id/issues/:iid/notes`) mit Body `/spend` als Quick Action wird ein System-Note erzeugt — kein sichtbarer Kommentar, keine Notification an Watcher.
3. **Keine Rückverfolgbarkeit:** aktuell speichert die App nur `status = 'booked'` auf dem Entry. Es gibt keine Referenz zurück zu GitLab — kein `note_id`, kein `booked_at`, kein Link. Korrekturen und Audits sind unmöglich.

---

## 1. GitLab API – Wechsel auf Notes

### Neuer Endpunkt

```
POST /api/v4/projects/:projectId/issues/:issueIid/notes
Content-Type: application/json

{ "body": "/spend 1h 30m 2024-06-17" }
```

**Response** (201 Created):
```json
{
  "id": 302,
  "body": "added 1h 30m of time spent at 2024-06-17",
  "system": true,
  "created_at": "2024-06-17T14:23:00.000Z",
  "noteable_iid": 42
}
```

### Regeln

- Datum im Body ist **ISO-Date ohne Uhrzeit** (`2024-06-17`), GitLab ignoriert die Uhrzeit im `/spend` Command.
- Dauer im GitLab-Format: `1h 30m`, `2h`, `0h 30m` — bestehendes `formatDuration()` bleibt.
- Der `id`-Wert aus der Response ist die `gitlab_note_id` — das ist unsere Rückreferenz.
- `system: true` bestätigt, dass es ein System-Note ist (kein Kommentar, keine Notification).

### Checkliste

- [ ] `gitlab/push.ts`: `bookTime()` umschreiben auf Notes-Endpunkt
- [ ] Signatur erweitern: `bookTime(projectId, issueIid, durationMinutes, spentAt, note)` → returns `GitLabBookingResult`
- [ ] Neuer Rückgabetyp:

```typescript
// gitlab/types.ts
interface GitLabBookingResult {
  noteId: number;
  createdAt: string; // ISO timestamp von GitLab
}
```

- [ ] `GitLabClient.bookTime()` Signatur anpassen (+ `spentAt: string`, Return `Promise<GitLabBookingResult>`)
- [ ] `FakeGitLabClient.bookTime()` anpassen: gibt fake `GitLabBookingResult` zurück, `bookedCalls` erweitern um `spentAt`
- [ ] Bestehende Fehler-Mapping bleibt (401, 404, 429, 5xx)

**Verify:** `mise run test-bun` grün

---

## 2. Bookings-Tabelle – Rückverfolgbarkeit

### Migration

`repository/migrations/002_bookings.sql`:

```sql
CREATE TABLE IF NOT EXISTS bookings (
    id               INTEGER PRIMARY KEY,
    entry_id         INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    ticket_id        INTEGER NOT NULL REFERENCES tickets(id),
    gitlab_note_id   INTEGER NOT NULL,
    project_id       INTEGER NOT NULL,
    issue_iid        INTEGER NOT NULL,
    duration_minutes INTEGER NOT NULL,
    spent_at         TEXT NOT NULL,
    booked_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(gitlab_note_id, project_id)
);

CREATE INDEX idx_bookings_entry_id ON bookings(entry_id);
```

### Felder erklärt

| Feld               | Zweck                                                           |
| ------------------ | --------------------------------------------------------------- |
| `entry_id`         | FK zum gebuchten Entry                                          |
| `ticket_id`        | FK zum Ticket (lokal), für Joins                                |
| `gitlab_note_id`   | ID der Note in GitLab — unsere Rückreferenz                    |
| `project_id`       | GitLab Project ID (für URL-Konstruktion)                        |
| `issue_iid`        | GitLab Issue IID (für URL-Konstruktion)                         |
| `duration_minutes` | gebuchte Dauer (kann von Entry-Dauer abweichen bei Korrektur)   |
| `spent_at`         | das Datum das an GitLab gesendet wurde (ISO-Date, UTC)          |
| `booked_at`        | Zeitpunkt der tatsächlichen Buchung (automatisch)               |

### URL-Konstruktion

Ein Booking-Link zu GitLab lässt sich aus den Feldern rekonstruieren:

```
{gitlabUrl}/projects/{projectId}/issues/{issueIid}#note_{gitlabNoteId}
```

→ Kein extra `web_url`-Feld nötig, wird im Frontend aus Settings + Booking-Daten gebaut.

### Repository

`repository/booking.ts`:

- [ ] `create(booking: BookingInsert): number` — INSERT, gibt ID zurück
- [ ] `listByEntry(entryId: number): Booking[]` — alle Buchungen eines Entries
- [ ] `listByDateRange(from: string, to: string): Booking[]` — für Übersichten
- [ ] `getByNoteId(noteId: number, projectId: number): Booking | null` — Duplikat-Check

In `repository/index.ts` registrieren.

### Checkliste

- [ ] Migration `002_bookings.sql` erstellen
- [ ] `repository/booking.ts` implementieren
- [ ] `repository/index.ts` erweitern
- [ ] `repository/booking.test.ts`: CRUD, Duplikat-Constraint, listByEntry

**Verify:** `mise run test-bun` grün

---

## 3. Shared Types

In `src/shared/types.ts`:

```typescript
interface Booking {
  id: number;
  entryId: number;
  ticketId: number;
  gitlabNoteId: number;
  projectId: number;
  issueIid: number;
  durationMinutes: number;
  spentAt: string;
  bookedAt: string;
}
```

### RPC erweitern

In `AppRPCType.bun.requests`:

```typescript
getBookingsForEntry: {
  params: { entryId: number };
  response: RpcResponse<Booking[]>;
};
```

In `AppRPCType.webview.messages` — keine Änderung nötig, `bookingCompleted` / `bookingFailed` bleiben.

### Checkliste

- [ ] `Booking` Type in `src/shared/types.ts`
- [ ] `BookingInsert` Type (ohne `id`, `bookedAt`) in `src/shared/types.ts`
- [ ] RPC `getBookingsForEntry` in `AppRPCType`
- [ ] `bun run tsc --noEmit` sauber

---

## 4. Service + Worker – Anpassungen

### BookingPayload erweitern

```typescript
// service/booking.ts
interface BookingPayload {
  entryId: number;
  ticketId: number;    // NEU: lokale Ticket-ID für bookings-Tabelle
  projectId: number;
  ticketIid: number;
  durationMinutes: number;
  spentAt: string;     // NEU: ISO-Date (Entry-Datum, UTC)
  note: string;
}
```

### service/booking.ts

`bookEntry(entryId)`:

1. Entry + Ticket laden (wie bisher)
2. `spentAt` aus `entry.date` ableiten (ist bereits UTC in DB)
3. `ticketId` (lokal) in Payload aufnehmen
4. Rest wie bisher: enqueue → status `'pending_booking'`

### worker/worker.ts

`handleBooking()`:

1. `gl.bookTime()` aufrufen — **jetzt mit `spentAt`** und erhält `GitLabBookingResult` zurück
2. **Booking-Record schreiben:** `repo.bookings.create({ entryId, ticketId, gitlabNoteId, projectId, issueIid, durationMinutes, spentAt })`
3. Entry status → `'booked'` (wie bisher)

### Checkliste

- [ ] `BookingPayload` erweitern um `ticketId` + `spentAt`
- [ ] `service/booking.ts`: `spentAt` + `ticketId` in Payload setzen
- [ ] `worker/worker.ts`: `handleBooking()` speichert Booking-Record nach erfolgreichem API-Call
- [ ] `worker/worker.test.ts`: prüft dass `repo.bookings.create()` aufgerufen wird mit korrekter `gitlab_note_id`
- [ ] `worker/worker.test.ts`: prüft dass `spentAt` an `gl.bookTime()` übergeben wird

**Verify:** `mise run test-bun` grün

---

## 5. RPC Handler

`app/handlers.ts`:

```typescript
getBookingsForEntry: (p) => wrap(() => repo.bookings.listByEntry(p.entryId)),
```

### Checkliste

- [ ] Handler registrieren
- [ ] Handler-Test (optional, da thin wrapper)

---

## 6. Frontend – Booking-History anzeigen

### Entry-Detail / Entry-Liste

Wenn ein Entry `status === 'booked'` hat, zeigt die UI:

- Anzahl Buchungen (Badge: "1× gebucht")
- Expandable: Liste der Buchungen mit Datum, Dauer, Link zu GitLab-Note

### Booking-Link

```typescript
function gitlabNoteUrl(settings: Settings, booking: Booking): string {
  return `${settings.gitlabUrl}/${settings.projectPath}/-/issues/${booking.issueIid}#note_${booking.gitlabNoteId}`;
}
```

→ Öffnet im Browser direkt die Note auf dem Issue.

### Checkliste

- [ ] `api/mock.ts`: `getBookingsForEntry` mit Fixture-Daten
- [ ] `api/real.ts`: `getBookingsForEntry` verdrahten
- [ ] Booking-History-Komponente: `BookingHistory.tsx` (< 100 LOC)
- [ ] In Entry-Liste oder Entry-Detail einbinden
- [ ] `bookingCompleted` Event: `invalidateQueries(keys.bookings(entryId))` ergänzen
- [ ] Link zu GitLab-Note als externer Link (Icon + `target="_blank"`)

**Verify:** `mise run dev` — gebuchter Entry zeigt Booking-History mit Link

---

## 7. Skill-Update

### gitlab-integration Skill

Buchungs-Sektion aktualisieren:

- Alter Endpunkt (`add_spent_time`) durch Notes-Endpunkt ersetzen
- `bookTime()` Signatur + Return-Type dokumentieren
- Hinweis: System-Note, keine Notification

### Checkliste

- [ ] `.claude/skills/gitlab-integration/SKILL.md` aktualisieren

---

## 8. Tests – Vollständig

### Backend

- [ ] `gitlab/push.test.ts`: Notes-Endpunkt wird korrekt aufgerufen (URL, Body, Method)
- [ ] `repository/booking.test.ts`: create, listByEntry, listByDateRange, UNIQUE-Constraint
- [ ] `worker/worker.test.ts`: Booking-Record wird nach erfolgreichem API-Call geschrieben
- [ ] `service/booking.test.ts`: `spentAt` wird korrekt aus Entry-Datum abgeleitet

### Frontend

- [ ] `BookingHistory.test.tsx`: rendert Buchungen, Link korrekt, leere Liste

**Verify:**

```bash
mise run test      # alle grün
mise run lint      # sauber
```

---

## Migration bestehender Daten

Entries mit `status = 'booked'` behalten ihren Status. Sie haben **keine** Einträge in der `bookings`-Tabelle — das ist akzeptabel. Die UI zeigt für diese Entries "Gebucht (vor Tracking)" oder schlicht keinen Link.

Keine Rück-Migration nötig, da die alten `add_spent_time`-Calls keine `note_id` zurückgeben.

---

## Nicht in Scope

- **Uhrzeit in GitLab:** `/spend` akzeptiert nur ein Datum, keine Uhrzeit. Das ist eine GitLab-Limitierung. Für Projektmanager reicht das Datum.
- **Booking löschen/korrigieren:** `/remove_spent_time` wäre möglich, ist aber ein separates Feature. Erstmal nur vorwärts buchen.
- **Mehrfachbuchung desselben Entries:** Entry-Status bleibt `'booked'` nach erster Buchung. Korrektur-Buchungen sind ein separates Feature (Entry müsste zurück auf `'draft'` gesetzt werden können).

---

## Definition of Done

- [x] `push.ts` nutzt Notes-Endpunkt statt `add_spent_time`
- [x] `bookings`-Tabelle existiert mit Migration
- [x] Jede erfolgreiche Buchung erzeugt einen Booking-Record mit `gitlab_note_id`
- [x] Frontend zeigt Booking-History mit Link zu GitLab-Note
- [x] Alle Tests grün, Lint sauber
- [x] Skill `gitlab-integration` aktualisiert
- [x] Kein Breaking Change für bestehende Entries mit `status = 'booked'`

### Abweichungen von der Spec

- **Migration heißt `003_bookings.sql`** (nicht `002`): `002_seed_schedules.sql`
  existiert bereits, Migrationen laufen alphabetisch.
- **Entry-Text erscheint als sichtbarer Kommentar.** Die Spec sah eine reine
  System-Note ohne Kommentar vor. Anforderung war aber, dass der Entry-Text
  (Titel + Notizen) in der Buchung auftaucht — daher wird er unter die
  `/spend` Quick Action gehängt und bei **255 Zeichen** gekappt.
- **`bookings.note`**: Der gebuchte Text wird zusätzlich lokal gespeichert,
  damit die Booking-History ihn ohne GitLab-Roundtrip anzeigen kann
  (`Booking.note` im shared type ergänzt).
- **Doppelbuchungs-Schutz (nicht in der Spec, aber zwingend):** `/spend` ist
  additiv und nicht idempotent — ein Retry nach erfolgreichem API-Call (DB-Fehler,
  verlorene Response, Crash) würde die Zeit ein zweites Mal buchen
  (Arbeitszeitbetrug). Lösung: jeder Buchungs-Note wird ein unsichtbarer
  Marker `<!-- entries-booking:entry=<id> -->` mitgegeben. `handleBooking()`
  ruft vor jedem `/spend` `gl.findBookingNote()` auf; existiert die Note schon,
  wird NICHT erneut gebucht, sondern nur der lokale Record rekonziliiert. Der
  Booking-Record wird zusätzlich über `getByNoteId` + `UNIQUE(note_id, project)`
  idempotent geschrieben. Tests in `worker.test.ts` decken den DB-Fehler- und
  den Duplikat-Event-Fall ab.
- **spentAt = Europe/Berlin-Kalendertag**, nicht UTC-Slice. Die Spec sagte
  `entry.date.slice(0,10)`; das hätte frühe Berliner Einträge (00:30 = 23:30Z
  Vortag) auf den falschen Tag gebucht — genau der Bug, den die Notes-API
  beheben sollte. Korrigiert via `formatInTimeZone`.
