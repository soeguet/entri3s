---
name: mise
description: mise ist der Task Runner und Versions-Manager für entries. Verwende diesen Skill bei der Ausführung von Befehlen, beim Hinzufügen neuer Workflows, oder wenn du weißt wie etwas ausgeführt werden soll. Immer `mise run <task>` statt roher Kommandos.
---

# mise – entries

## Regel: mise run, keine rohen Kommandos

```bash
# FALSCH
bun test ./src/bun/
npx oxlint .
bun run electrobun dev

# RICHTIG
mise run test-bun
mise run lint
mise run dev-electrobun
```

Ausnahme: einmalige Explorationskommandos die nicht wiederholt werden.

## Regel: Tasks aktuell halten

Neuer wiederholbarer Workflow → erst Task in `mise.toml`, dann `mise run`.
Rohe Kommandos nie dokumentieren ohne entsprechenden Task.

## Tasks

Quelle der Wahrheit ist `mise.toml` im Projekt-Root. `mise tasks` listet alle auf.
Aktueller Stand:

| Task             | Zweck                                                        |
| ---------------- | ----------------------------------------------------------- |
| `dev`            | Frontend im Browser, Mock-Modus (`vite --mode mock`)        |
| `build-fe`       | Frontend-Build (Vite → `dist/`)                             |
| `dev-electrobun` | Vollständige App (hängt von `build-fe` ab)                  |
| `build`          | Production Build (hängt von `build-fe` ab)                  |
| `test-bun`       | `bun test ./src/bun/`                                        |
| `test-fe`        | Vitest fürs Frontend                                         |
| `test`           | beide Suiten (`test-bun` + `test-fe`)                       |
| `lint`           | `oxfmt` dann `oxlint` über `./src/` — erst fmt, dann lint   |
| `check`          | Quality-Gate: fmt+lint → `tsc --noEmit` → beide Test-Suiten |
| `typecheck`      | `bunx tsc --noEmit`                                          |
| `doctor`         | React Doctor                                                |
| `migrate`        | Migrations (Dev)                                             |
| `backup`         | Dev-SQLite sichern                                           |

Non-obvious: `dev` läuft im Vite-Mode `mock` (lädt `api/mock.ts` statt `real.ts`,
siehe `vite.config.ts`) — kein `VITE_MOCK`-Env nötig, funktioniert so auch unter
Windows/PowerShell. `oxfmt`/`oxlint`/`bun`/`node`/`python` kommen aus `[tools]`
in `mise.toml`, daher ohne `npx` aufrufbar.
