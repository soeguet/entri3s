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

| Was                 | Wo                                      |
| ------------------- | --------------------------------------- |
| Coding-Konventionen | `.claude/skills/`                       |
| Warum etwas so ist  | Kommentar an der jeweiligen Code-Stelle |

Es gibt bewusst **keine** Spec-/Plan-/Audit-Dateien mehr. Der Code ist die
einzige Quelle der Wahrheit.

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

## Dokumentations-Policy (verbindlich)

Wir führen **keine** separate Doku mehr — keine Spec-, Plan-, README- oder
Audit-Markdown-Dateien. Der Code ist die einzige Quelle der Wahrheit.

- **Normalfall:** gar nicht dokumentieren. Lesbarer Code und sprechende Namen
  genügen.
- **Ausnahme:** Nur **nicht-normale** Entscheidungen festhalten — bewusste
  Abweichungen, Workarounds, entfernte Prüfungen, überraschende Trade-offs.
  Und zwar **direkt als Kommentar an der betroffenen Code-Stelle**, niemals in
  einer separaten Datei. Knapp: *was* weicht ab und *warum*.
- Soll so eine kommentierte Stelle später grundlegend geändert werden, den User
  darauf aufmerksam machen und ggf. nachfragen, warum es ursprünglich so
  umgesetzt wurde — bevor man sie umbaut.
