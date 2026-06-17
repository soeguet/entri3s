# 13 – Overlaps erlauben · Buchungen korrigieren · Timelog statt Kommentar

Kleine, zusammenhängende Korrektur-Iteration nach Nutzer-Feedback. Drei
unabhängige Punkte:

## 1. Entries dürfen sich zeitlich überschneiden

Die Overlap-Prüfung blockierte parallele Tätigkeiten (z.B. Meeting während eines
laufenden Tasks). **Entfernt:**

- `service/entry.ts`: `assertNoOverlap` + Helfer gestrichen.
- `api/mock.ts`: `hasOverlap`-Checks gestrichen.
- `EntryForm.tsx`: `OVERLAP`-Inline-Fehler entfernt.
- Tests entsprechend angepasst (Overlaps sind jetzt erlaubt).

## 2. Buchung löschen → korrigiert neu buchen

Neuer RPC `deleteBooking({ bookingId })` → Service legt ein `booking_delete`-Event
in die Outbox. Der Worker:

1. löscht den GitLab-Timelog (`timelogDelete`),
2. entfernt den lokalen `bookings`-Record,
3. setzt den Entry zurück auf `draft`, sofern keine weitere Buchung mehr existiert
   → der Entry ist wieder buchbar.

UI: pro Buchung ein "Löschen"-Button in `BookingHistory.tsx`.

Idempotenz: ist der Record beim Verarbeiten schon weg (Retry nach Erfolg), ist der
Worker-Handler ein No-op; ein bereits gelöschter Timelog wird von `deleteTimelog`
toleriert.

## 3. Kein Kommentar am Issue — Text in die Zeiterfassung

**Vorher:** Buchung über die Notes-API mit `/spend` Quick Action → erzeugte einen
sichtbaren **Kommentar** am Issue (mit Idempotenz-Marker im Body).

**Jetzt:** Buchung über GraphQL `timelogCreate`. Der Buchungstext landet in der
`summary` des Timelogs ("Add time entry → Summary"), **kein Kommentar**, keine
Notification.

Folgeänderungen:

- `gitlab/push.ts` → entfernt; neu `gitlab/timelog.ts` (`createTimelog`,
  `findTimelog`, `deleteTimelog`).
- `GitLabClient`-Interface + `FakeGitLabClient` umgestellt.
- `timelogCreate` braucht die **globale** Issue-ID → Sync zieht jetzt zusätzlich
  `id` (GID) aus der GraphQL-Issues-Query; gespeichert in
  `tickets.gitlab_global_id` (Migration `005`).
- `bookings.gitlab_note_id` → `bookings.gitlab_timelog_id` umbenannt
  (Migration `005`, `ALTER TABLE ... RENAME COLUMN`). Shared type:
  `Booking.gitlabNoteId` → `gitlabTimelogId`.
- Doppelbuchungs-Schutz über `findTimelog` statt Note-Marker (best-effort; Match
  auf Issue-iid + Dauer + Datum + Summary).

## Verify

`bun test ./src/bun/` · Frontend `vitest run` · `tsc --noEmit` · `oxlint`/`oxfmt` —
alle grün.

## Bekannte Grenzen

- Buchungen vor dieser Iteration haben in `gitlab_timelog_id` noch alte Note-IDs;
  ein `deleteBooking` darauf schlägt fehl (kein passender Timelog). Akzeptiert.
- Tickets ohne `gitlab_global_id` (noch nicht neu gesynct) liefern beim Buchen
  einen klaren `NEEDS_SYNC`-Fehler; nach dem nächsten Sync behoben.
