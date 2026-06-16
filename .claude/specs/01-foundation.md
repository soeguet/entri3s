# Phase 01 – Projekt-Setup & Foundation

**Ziel:** Lauffähiges Grundgerüst mit korrekter Verzeichnisstruktur, Electrobun-Setup, SQLite-Schema und funktionierendem `mise run test`.

**Skills lesen:** `bun-conventions`, `sqlite-patterns`, `mise`

---

## 1. Verzeichnisstruktur

```
entries/
├── CLAUDE.md
├── mise.toml
├── package.json
├── electrobun.config.ts
├── src/
│   ├── bun/
│   │   ├── index.ts
│   │   ├── app/
│   │   ├── service/
│   │   ├── repository/
│   │   │   └── migrations/
│   │   ├── gitlab/
│   │   ├── worker/
│   │   ├── scheduler/
│   │   └── keychain/
│   ├── shared/
│   │   └── types.ts
│   └── views/
│       └── main/
│           ├── index.html
│           ├── main.tsx
│           ├── vite.config.ts
│           └── src/
│               ├── api/
│               ├── features/
│               ├── routes/
│               ├── components/
│               ├── fixtures/
│               └── lib/
└── .claude/
```

### Checkliste

- [ ] `bun create electrobun` oder manuell init
- [ ] `electrobun.config.ts` konfiguriert mit `views: { main: 'src/views/main/index.html' }`
- [ ] Alle Verzeichnisse unter `src/bun/` angelegt
- [ ] `src/shared/types.ts` angelegt (zunächst leer, Typen folgen in Phase 03)
- [ ] `src/views/main/` mit Vite + React Setup
- [ ] `.gitignore`: `data/`, `build/`, `node_modules/`, `*.db`, `*.db-shm`, `*.db-wal`, `artifacts/`

---

## 2. mise.toml

### Checkliste

- [ ] `[tools]` mit bun und node Versionen
- [ ] Alle Tasks aus `mise` Skill angelegt
- [ ] `mise run dev` startet Vite im Mock-Modus
- [ ] `mise run dev-electrobun` startet Electrobun
- [ ] `mise run test` läuft ohne Fehler (auch wenn noch keine Tests vorhanden)
- [ ] `mise run lint` läuft ohne Fehler

**Verify:** `mise tasks` zeigt alle Tasks

---

## 3. SQLite Foundation

### Checkliste

- [ ] `src/bun/repository/db.ts` mit `openDatabase(dataDir)` — WAL, foreign_keys, Migrations
- [ ] `src/bun/repository/migrations/001_initial_schema.sql` — vollständiges Schema aus `sqlite-patterns` Skill
- [ ] `src/bun/repository/migrations/002_seed_schedules.sql`:
  ```sql
  INSERT INTO schedules (name, interval_sec) VALUES
    ('gitlab_sync', 300),
    ('orphan_check', 3600);
  ```
- [ ] `mise run migrate` läuft ohne Fehler
- [ ] SQLite-Datei landet in `os.homedir()/.config/entries/entries.db` (Windows: `APPDATA/entries/entries.db`)

---

## 4. App Data Directory

### Checkliste

- [ ] `src/bun/index.ts` ermittelt `dataDir` plattformübergreifend
- [ ] Verzeichnis wird beim Start angelegt falls nicht vorhanden
- [ ] Pfad wird als Argument weitergereicht, nicht als Global

---

## 5. Electrobun Grundsetup

### Checkliste

- [ ] `electrobun.config.ts` korrekt konfiguriert
- [ ] `src/bun/index.ts` öffnet `BrowserWindow` mit `views://main/index.html`
- [ ] `mise run dev-electrobun` öffnet leeres Fenster ohne Fehler
- [ ] `mise run dev` öffnet Vite im Browser ohne Fehler

---

## Definition of Done

- [ ] `mise run dev` öffnet Frontend im Browser (Mock-Modus)
- [ ] `mise run dev-electrobun` öffnet Electrobun-Fenster
- [ ] `mise run test` grün (leer ist ok)
- [ ] `mise run lint` grün
- [ ] SQLite mit Schema liegt in korrektem Verzeichnis
- [ ] Kein Code außerhalb der definierten Verzeichnisse

**→ Phase 01 ✅ in PLAN.md setzen, Phase 02 beginnen**
