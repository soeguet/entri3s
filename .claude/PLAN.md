# entries v2 – Master Plan

## Phasenübersicht

| #   | Phase                      | Status   | Spec                              |
| --- | -------------------------- | -------- | --------------------------------- |
| 01  | Projekt-Setup & Foundation | ✅ fertig | `specs/01-foundation.md`          |
| 02  | Bun Backend Core           | ✅ fertig | `specs/02-bun-backend.md`         |
| 03  | Electrobun Bridge          | ✅ fertig | `specs/03-electrobun-bridge.md`   |
| 04  | Frontend Foundation        | ✅ fertig | `specs/04-frontend-foundation.md` |
| 05  | Feature: Entries           | ✅ fertig | `specs/05-11-features.md`         |
| 06  | Feature: GitLab Sync       | ✅ fertig | `specs/05-11-features.md`         |
| 07  | Feature: Booking           | ✅ fertig | `specs/05-11-features.md`         |
| 08  | Feature: Tickets           | ✅ fertig | `specs/05-11-features.md`         |
| 09  | Feature: Management        | ✅ fertig | `specs/05-11-features.md`         |
| 10  | Feature: Settings          | ✅ fertig | `specs/05-11-features.md`         |
| 11  | Testing & Hardening        | ✅ fertig | `specs/05-11-features.md`         |

Status: ⬜ offen · 🔄 in Arbeit · ✅ abgeschlossen

## Abhängigkeiten

```
01 → 02 → 03 → 04 → 05
                    ↓
               06 → 07 → 08 → 09 → 10 → 11
```

## Arbeitsweise für Claude Code Agents

1. **Lies CLAUDE.md** – Überblick und Regeln
2. **Prüfe diesen Plan** – welche Phase ist aktiv (🔄)?
3. **Öffne die Spec** der aktiven Phase
4. **Lies die referenzierten Skills**
5. **Arbeite Checkliste von oben nach unten ab**
6. **Verifiziere mit `mise run`** am Ende jeder Sektion
7. **Markiere abgeschlossene Items** mit `[x]`
8. **Aktualisiere den Status** in dieser Datei

### Regeln

- Nie eine Phase überspringen wenn Abhängigkeit noch ⬜
- Spec schlägt Intuition – Abweichungen kommentieren, nicht still ignorieren
- Neue wiederholbare Workflows → erst Task in `mise.toml`, dann `mise run`
