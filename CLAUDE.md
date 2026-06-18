# entries v2

Desktop app für Arbeitszeiterfassung, Notizen, GitLab Ticket-Zuweisung und Buchung.
Stack: Electrobun · Bun (main process) · React · SQLite

## Arbeitsmodell: Supervisor & Subagents (verbindlich)

Dieses Modell gilt für **jede** Session und steht über allen anderen Regeln zur
Arbeitsweise.

- **Der aktuelle (oberste) Agent ist der Supervisor.** Er schreibt selbst keinen
  Produktivcode, sondern plant, delegiert, prüft und nimmt ab.
- **Jeder Task wird über einen Subagent erledigt** (Tool `Agent`). Auch kleine
  Aufgaben. Der Supervisor führt Umsetzungsarbeit nicht selbst aus.
- **Der Supervisor ist streng.** Er definiert **vor** der Delegation harte, klare
  Abnahmekriterien (Definition of Done: was genau, womit verifiziert, welche
  Tests/Checks grün, welche Dateien/LOC-Grenzen, welche Specs/Skills gelten).
- **Abnahme ist Pflicht.** Der Supervisor prüft das Ergebnis jedes Subagents
  gegen die Abnahmekriterien — nicht nur die Behauptung des Subagents, sondern
  den tatsächlichen Stand (Diff lesen, `mise run check`/Tests, Specs abgleichen).
- **Bei Inkonsistenzen oder Problemen** wird die Nacharbeit an einen **weiteren**
  Subagent vergeben (mit präzisem Fehlerbefund), iterativ, bis die Abnahme
  vollständig erfüllt ist. Kein „passt schon".
- **Der Supervisor haftet** für die Arbeit aller Subagents. Was er abnimmt,
  verantwortet er — im Zweifel lieber eine weitere Iteration als eine schwache
  Abnahme.

## Schnellstart

```bash
mise tasks               # alle verfügbaren Tasks
mise run dev             # Frontend im Browser (kein Electrobun, schnell)
mise run dev-electrobun  # vollständige App
mise run test            # alle Tests
mise run lint            # oxlint + oxfmt
```

## Orientierung

| Was                          | Wo                  |
| ---------------------------- | ------------------- |
| Architektur & Entscheidungen | `.claude/README.md` |
| Gesamtplan & Phasenstatus    | `.claude/PLAN.md`   |
| Detailspecs pro Phase        | `.claude/specs/`    |
| Coding-Konventionen          | `.claude/skills/`   |

## Projektstruktur

```
src/
├── bun/          ← Main Process (Bun TypeScript): SQLite, GitLab, Worker, Scheduler
├── shared/       ← types.ts: RPC-Typen und Domain-Types (SINGLE SOURCE OF TRUTH)
└── views/main/   ← React Frontend
```

## Wichtigste Regeln (Kurzform)

- **Task Runner:** immer `mise run <task>`, nie rohe Kommandos
- **LOC:** 250–300 pro Datei, hard limit ~350
- **KISS über DRY:** lesbar schlägt elegant
- **Props:** niemals destructuren, immer `props.xyz`
- **Typen:** NUR aus `src/shared/types.ts` – nie separat definieren, nie duplizieren
- **RPC:** Frontend ruft `electroview.rpc.request.*` auf, nie direkt backend-code
- **SQLite:** UTC speichern, `Europe/Berlin` nur im Frontend
- **Fehler:** immer `AppError` in Response, nie rohe Exceptions über RPC

## Aktueller Arbeitsstand

Lies `.claude/PLAN.md` → dort steht welche Phase aktiv ist.
Lies dann die entsprechende Spec in `.claude/specs/`.
