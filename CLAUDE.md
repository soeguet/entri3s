# entries v2

Desktop app für Arbeitszeiterfassung, Notizen, GitLab Ticket-Zuweisung und Buchung.
Stack: Electrobun · Bun (main process) · React · SQLite

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
