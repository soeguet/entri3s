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

## Canonical Tasks

```toml
[tools]
bun = "latest"
node = "22"

[tasks.dev]
description = "Frontend im Browser, kein Electrobun nötig"
run = "cd src/views/main && VITE_MOCK=true bun run vite"

[tasks.dev-electrobun]
description = "Vollständige App mit Electrobun"
run = "bun run electrobun dev"

[tasks.build]
description = "Production Build"
run = "bun run electrobun build"

[tasks.test-bun]
description = "Bun Tests für Main Process"
run = "bun test ./src/bun/"

[tasks.test-fe]
description = "Vitest für Frontend"
run = "cd src/views/main && bun run vitest run"

[tasks.test]
description = "Alle Tests"
depends = ["test-bun", "test-fe"]

[tasks.lint]
description = "oxlint + oxfmt"
run = """
npx oxlint ./src/
npx oxfmt ./src/
"""

[tasks.doctor]
description = "React Doctor"
run = "cd src/views/main && npx react-doctor"

[tasks.migrate]
description = "Migrations ausführen (Dev)"
run = "bun run ./src/bun/repository/migrate.ts"

[tasks.backup]
description = "Dev SQLite sichern"
run = "cp ./data/entries.db ./data/entries.backup.$(date +%Y%m%d%H%M%S).db"
```

## Verfügbare Tasks anzeigen

```bash
mise tasks
```

## Windows-Hinweis

`VITE_MOCK=true` in PowerShell erfordert entweder:

- `cross-env`: `npx cross-env VITE_MOCK=true bun run vite`
- Oder `.env.mock` Datei mit `VITE_MOCK=true` und `--env-file` Flag

```toml
[tasks.dev]
run = "cd src/views/main && bun run vite --mode mock"
# vite.config.ts: mode 'mock' nutzt mock.ts statt real.ts
```

## mise.toml Location

Immer im Projekt-Root, neben `package.json` und `electrobun.config.ts`.
