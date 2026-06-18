# entries

Desktop-App für Arbeitszeiterfassung, Notizen, GitLab-Ticket-Zuweisung und Buchung.
Stack: Electrobun · Bun · React · SQLite.

## Entwicklung

```bash
mise run dev             # Frontend im Browser (schnell)
mise run dev-electrobun  # vollständige App
mise run test            # Tests
mise run check           # Quality-Gate (fmt, lint, typecheck, Tests)
```

Konventionen und Architektur stehen in `CLAUDE.md` und `.claude/skills/`.
Begründungen für besondere Entscheidungen stehen als Kommentar an der jeweiligen
Code-Stelle.
