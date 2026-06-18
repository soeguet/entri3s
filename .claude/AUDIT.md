# Audit: Plan vs. Implementierung

Stand: 2026-06-18 · Branch `claude/code-review-documentation-5um9sv`

Abgleich der tatsächlichen Implementierung gegen `PLAN.md` + `specs/`. Zweck:
festhalten, wo Code und Plan auseinanderlaufen, damit nachfolgende Agents nicht
veralteten Specs vertrauen. **Kein Code wurde im Zuge dieses Audits geändert** —
nur Doku (`specs/12`, `specs/15` korrigiert, diese Datei neu).

## Gesamtbild

Der Stand ist solide. Alle Phasen in `PLAN.md` sind ✅ und das deckt sich mit dem
Code. Verifiziert am 2026-06-18:

- `bun test ./src/bun/` → **108 pass / 0 fail**
- `vitest run` (Frontend) → **62 pass / 0 fail**
- `bunx tsc --noEmit` → **sauber**
- Keine Datei über dem 350-LOC-Hardlimit (größte: `RunningTimerWidget.tsx` 309).

> ⚠️ **Setup-Hinweis für Agents:** Im frischen Container fehlen Dependencies
> (`electrobun`, `date-fns-tz` etc.). `bun test` zeigt sonst 3 Phantom-Fails
> („Cannot find module"). **Immer zuerst `bun install`** — dann sind alle Tests
> grün. Das sind keine echten Bugs.

Es gibt keine BUG-Severity-Funde im Backend-Kern (Repository/Service/Worker/
Scheduler/RPC-Bridge). Die Funde sind: veraltete Spec-Texte und ein paar kleine
Code-Inkonsistenzen.

---

## A. Spec ↔ Code-Drift (Doku-Schulden)

Für Agents am wichtigsten: Specs, die etwas anderes behaupten als der Code tut.

| # | Spec | Behauptet | Code tut tatsächlich | Status |
|---|------|-----------|----------------------|--------|
| A1 | `12-gitlab-graphql-evaluation.md` | „Buchungen bleiben REST" (Notes-API `/spend`) | Buchungen via GraphQL `timelogCreate` (`gitlab/timelog.ts`), `push.ts` entfernt | ✅ Banner ergänzt (überholt durch Spec 13) |
| A2 | `15-running-entry.md` | — | Datei endete mit kaputten `</content></invoke>`-Tags | ✅ korrigiert |
| A3 | `02-bun-backend.md` §3 | `syncIssues(projectId)` / `checkOrphans(projectId)` | parameterlos, projektübergreifend (`gl.fetchIssues()` global) — Folge des Multi-Projekt-Umbaus (Spec 14) | ⬜ Spec-Text veraltet |
| A4 | `02`, `03`, `05-11` Checklisten | viele `[ ]` unchecked | implementiert & getestet | ⬜ Checkboxen nie abgehakt (nur Spec 13/15 sind sauber) |
| A5 | `14-ticket-grouping.md` | Komponente `TicketCombobox.tsx` | heißt `TicketPicker.tsx` (gleiche Funktion: Suche, Projekt-Gruppierung, „zuletzt verwendet", Tastaturnav) | ⬜ Namensdrift |
| A6 | `10` (Settings) | „Project ID"-Feld → `settings` | entfällt; `Settings` = nur `gitlabUrl` + `syncIntervalSec` (Multi-Projekt, Spec 14) | ⬜ bewusste Ablösung, Spec-Text veraltet |
| A7 | `04`/`07` | Status `dead` / Entry-Status-Namen | Entry-Status heißt `booking_failed`; `dead` betrifft nur Event-Queue/`deadEvents` | ⬜ Namensdrift, sauber gehandhabt |
| A8 | `03` DoD | „max ~20 Request-Typen", `index.ts` < 60 LOC | 35 Request-Typen; `index.ts` = 89 LOC mit Window-Bounds-/Tray-Logik | ⬜ über Plan-Budget gewachsen (funktional ok) |
| A9 | `02`/`03` Wiring | `startWorker(..., win)`, `createRpc(svc, win)` | `AppEmitter`-Abstraktion statt `win` (`emitter.ts`/`window-emitter.ts`) | ⬜ saubere Verbesserung, Spec-Template veraltet |

A1–A2 sind erledigt. A3–A9 bewusst **nicht** „korrigiert", weil sie teils
größere Spec-Umschriebe wären; hier dokumentiert, damit niemand den alten
Spec-Wortlaut für bare Münze nimmt.

---

## B. Echte Code-Funde (klein, actionable)

Keiner ist kritisch; Tests sind grün. Für nachfolgende Agents als TODO:

- [ ] **B1 — Dark-Mode-Bug: hartcodierte slate-Farben.**
  `src/views/main/src/features/entries/RunningTimerWidget.tsx:239` und `:273`
  nutzen `border-slate-200 text-slate-600 hover:bg-slate-50` / `text-slate-400`
  statt Theme-Tokens (`border-border`, `text-muted-foreground` …). Im Dark Mode
  hell-auf-hell. Rest der Datei ist durchgängig tokenisiert → isolierte
  Regression. *Fix: Tokens wie im übrigen Widget verwenden.*

- [ ] **B2 — Vitest-Mock unvollständig.**
  `src/views/main/src/api/__mocks__/index.ts` fehlt `setEntryTags` (real.ts +
  mock.ts haben es, types.ts deklariert es). `RunningTimerWidget.test.tsx:74`
  umgeht das bereits manuell mit explizitem Spy — Workaround, kein Testbruch,
  aber Stolperfalle für neue Tests. *Fix: `setEntryTags` im Manual-Mock ergänzen.*

- [ ] **B3 — Veraltetes Feld im Vitest-Mock.**
  `__mocks__/index.ts:40` liefert `getSettings` mit `projectId: 42`, obwohl
  `Settings` (`types.ts:131`) kein `projectId` mehr hat → type-inkompatibles
  Objektliteral. *Fix: `projectId` aus dem Mock entfernen.*

- [ ] **B4 — Toter Verweis im Doc-Kommentar.**
  `src/bun/gitlab/client.ts:21` nennt `push.ts` („… die fetch.ts / push.ts
  brauchen"), das es nicht mehr gibt. *Fix: Kommentar aktualisieren.*

- [ ] **B5 — Fake-GitLab-Client repliziert Summary-Normalisierung nicht.**
  Real: `createTimelog`/`findTimelog` `trim()` + `slice(0,255)`
  (`gitlab/timelog.ts:111-117`). Fake (`gitlab/types.ts:103,120-127`) speichert/
  matcht roh. Greift nur bei >255-Zeichen- oder ungetrimmten Summaries; in der
  Praxis ist `note` via `bookingNote` schon getrimmt → niedrige Severity.
  Test/Prod könnten bei Langtext divergieren. *Fix optional: Fake angleichen.*

- [ ] **B6 — Mock-Modus emittiert keine Events → fehlende Cross-List-Invalidierung.**
  Im Real-Modus invalidieren `bookingCompleted` & Co. entries+bookings+deadEvents
  (`api/real.ts:38-43`). Der Dev-Mock (`mock.ts`) ist ein reines Funktionsmodul
  ohne Message-Handler; `EntriesPage.tsx:104` invalidiert beim `book` nur
  `keys.entries()`. Folge: im **Mock-Modus** aktualisieren sich Buchungshistorie /
  Dead-Events nicht automatisch. Nur Dev-Workflow betroffen, Prod korrekt.
  *Fix optional: Mock könnte betroffene Keys nach Mutationen selbst invalidieren.*

---

## C. Bewusst geprüft & in Ordnung (keine Aktion)

Damit niemand diese erneut „findet":

- **Overlap-Prüfung entfernt** (Spec 13) — Absicht, kommentiert in
  `service/entry.ts`. Kein toter Overlap-Code, keine Mathe-Bugs.
- **Event-Queue:** `claimNext` atomar (`UPDATE … RETURNING`), Dead-Letter nach
  genau 3 Fails, `resetStuck()` beim Start (`index.ts:18`). Korrekt.
- **deleteBooking** (Spec 13): Event + Worker-Handler vollständig, idempotent
  (No-op bei fehlendem Record, toleriert extern gelöschten Timelog).
- **GraphQL-Fehler:** `errors[]` bei HTTP 200 behandelt; 401/403/404/429/5xx
  gemappt; Rate-Limiter (5 req/s) zwischen REST & GraphQL geteilt.
- **Spec 14:** Sync zieht & persistiert Projekte (`fullPath`, `gitlab_global_id`);
  `NEEDS_SYNC`-Fehler wenn globale ID fehlt.
- **RPC-Vertrag:** alle 35 Requests haben Handler + real + mock; alle 6 Events
  typisiert & emittiert; jeder Handler via `wrap()`/`toAppError` (keine rohen
  Exceptions über RPC).
- **Settings:** Token nur im Keychain (Password-Input), Backup verdrahtet,
  App-Version sichtbar.
- **Props-Regel:** Feature-Komponenten destrukturieren nie; nur shadcn-Primitives
  `badge.tsx`/`button.tsx` nutzen `...rest`-Forwarding (idiomatisch).

---

## Empfohlene nächste Schritte für Agents

1. B1 (Dark-Mode) + B2/B3/B4 sind triviale, risikoarme Fixes — gute erste PR.
2. Wer Specs anfasst: A3–A8 beim Vorbeikommen im jeweiligen Spec-Text glätten
   (oder hier abhaken), damit der Wortlaut wieder dem Code entspricht.
3. Vor jeder Test-Runde: `bun install` (siehe Setup-Hinweis oben).
