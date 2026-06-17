# Phase 15 – Laufender Entry (Start/Stop-Timer)

**Voraussetzung:** Phase 05 ✅ · **Skills:** `sqlite-patterns`, `electrobun-bridge`,
`react-typescript`

## Motivation

Bisher entstehen Entries ausschliesslich retrospektiv: man muss Start- und
Endzeit aus dem Gedächtnis ins Formular eintragen. Es fehlt ein laufender Entry,
den man per **Start** beginnt und per **Stop** abschliesst.

## Kernidee

`date` ist bereits der **Start** eines Entries, das Ende wird aus
`date + durationMinutes` abgeleitet. Ein laufender Entry ist daher schlicht ein
Entry, dessen Ende noch nicht feststeht:

- Neuer Status `running`. `date` = Startzeitpunkt, `durationMinutes` bleibt `0`
  solange er läuft (Frontend zeigt Live-Dauer `now − date`).
- **Stop** friert `durationMinutes = max(1, round((now − date)/60s))` ein und
  setzt Status → `draft`. Ab da ein normaler, buchbarer Entry.
- **Genau ein** laufender Entry gleichzeitig (DB-Invariant via partiellem
  Unique-Index). Liegt in SQLite → übersteht App-Neustart.

## Checkliste

**Datenmodell**

- [x] `EntryStatus` um `"running"` erweitert (`src/shared/types.ts`)
- [x] Migration `007_running_entry.sql`: partieller Unique-Index `status='running'`
- [x] `repo.entries.getRunning()` liefert den laufenden Entry oder `null`

**Service / RPC**

- [x] `svc.entry.start({ ticketId, notes, startAt? })` – wirft `ALREADY_RUNNING`
- [x] `svc.entry.stop(id)` – friert Dauer ein, Status → `draft`
- [x] `svc.entry.getRunning()`
- [x] RPC `getRunningEntry`, `startEntry`, `stopEntry` verdrahtet
- [x] Mock-API (`api/mock.ts`) bildet dieselbe Semantik nach

**Frontend**

- [x] `RunningTimerWidget` unten in der Sidebar (`__root.tsx`), auf jeder Route
      sichtbar, lokaler 1s-Tick, Notiz + Ticket setzbar, Start/Stop
- [x] Notiz fortlaufend editierbar: debounced Autosave (600ms) + Flush onBlur +
      garantierter Save beim Stop, via schlankem `setEntryNotes`-RPC
- [x] `running`-Badge (`entryStatus.tsx`)
- [x] Laufender Entry erscheint nicht doppelt in der Entry-Tabelle
- [x] Lücken-Banner auf der Entries-Seite: ungebuchte Zeit seit letztem
      Entry-Ende heute, Button „Lücke füllen & weiter" startet Timer gapfrei

**Tests**

- [x] `service/entry.test.ts`: start/stop, Single-Invariant, gapfreier Start
- [x] `RunningTimerWidget.test.tsx`: Start- und Stop-Pfad

## Definition of Done

- [x] Start → Live-Timer → Stop erzeugt einen `draft`-Entry mit korrekter Dauer
- [x] Nur ein laufender Timer; übersteht App-Neustart
- [x] Gapfreies Anschliessen an den letzten Entry funktioniert
- [x] `mise run test` + `mise run lint` grün
</content>
</invoke>
