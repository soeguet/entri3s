# .claude/

Claude Code Konfiguration für das entries Projekt.

## Der wichtigste Unterschied zu Wails

**Kein Codegen.** Typen leben in `src/shared/types.ts` und werden von Bun-Seite
und Frontend-Seite gleichermaßen importiert. Kein `generate types`, kein Drift.

## Skills

| Skill                 | Scope                                                             |
| --------------------- | ----------------------------------------------------------------- |
| `bun-conventions`     | Dateistruktur, LOC, Fehlerbehandlung, Logging, DI im Main Process |
| `electrobun-bridge`   | RPC-Pattern, shared types, Mock/Real-Swap, Events                 |
| `sqlite-patterns`     | bun:sqlite, WAL, Migrations, Event Queue, Backup                  |
| `gitlab-integration`  | TypeScript GitLab Client, Rate Limiting, Pagination               |
| `react-typescript`    | Props-Stil, Typen aus shared/, Linting, React Compiler            |
| `testing-conventions` | bun test für Main Process, Vitest für Frontend                    |
| `mise`                | Task Runner, alle Tasks, mise run first                           |
| `bootstrap`           | Frische Shell/Container komplett projekt-fertig machen            |

## Audit

`AUDIT.md` – Abgleich Plan ↔ Implementierung (Drift-Liste, offene Klein-Fixes).
Lesen, bevor man dem Wortlaut alter Specs vertraut.

## MCP Server

`mcp.json` – SQLite MCP für direkte DB-Inspektion im Entwicklungsbetrieb.

## Kernentscheidungen

- KISS über DRY
- 250–300 LOC pro Datei
- `src/shared/types.ts` ist der einzige Ort für Typen
- Props niemals destructuren
- UTC in DB, `Europe/Berlin` im Frontend
- Event Queue (Outbox) für alle GitLab-Schreiboperationen
