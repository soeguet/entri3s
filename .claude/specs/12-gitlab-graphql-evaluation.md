# Evaluierung: GitLab REST → GraphQL

Status: ⬜ Vorschlag / Entscheidung offen
Kontext: Wunsch, von der REST-Integration (`src/bun/gitlab/`) auf GraphQL zu wechseln,
weil GraphQL persönlich vertrauter ist und ggf. besser für den projektübergreifenden
Sync passt.

## Ausgangslage (heute, nach Multi-Projekt-Umbau)

- Sync läuft projektübergreifend über REST `GET /api/v4/issues?scope=all` mit
  Offset-Pagination (`page`/`per_page`, `x-total-pages`).
- Buchungen laufen über die REST Notes-API (`POST /projects/:id/issues/:iid/notes`
  mit `/spend`-Quick-Action) inkl. Idempotenz-Marker und Vorab-Check
  (`findBookingNote`).
- Inkrementell über `updated_after` aus der `schedules`-Tabelle.
- Rate-Limiter 5 req/s, Fehler-Mapping in `client.ts`.

## Warum GraphQL überhaupt erwägen?

| Kriterium | REST (heute) | GraphQL |
| --- | --- | --- |
| Felder gezielt holen | ganze Objekte, Overfetch | nur benötigte Felder |
| Projektübergreifend | `GET /issues` ok, aber alle Felder | `issues`-Connection, gezielt |
| Pagination | Offset (`page`) | Cursor (`after`/`pageInfo`) – stabiler bei großen Mengen |
| Mehrere Ressourcen pro Call | mehrere Requests | ein Request (weniger Roundtrips → weniger Timeout-Risiko) |
| Self-hosted Verfügbarkeit | überall | ab GitLab 12.x, stabil; einige Felder versionsabhängig |
| Zeitbuchung (`/spend`) | Notes-API, erprobt | **kein** vollwertiges `/spend`-Mutationsäquivalent mit freiem Datum |

## Knackpunkt: Buchungen

`/spend <dauer> <datum>` über die Notes-Quick-Action ist der einzige Weg, ein
**frei wählbares Buchungsdatum** zu setzen (REST `add_spent_time` setzt immer
`now`). GraphQL hat `createNote` als Mutation — die Quick-Action `/spend` im
Note-Body funktioniert auch dort. Aber: der Idempotenz-/Doppelbuchungsschutz
(Marker + `findBookingNote`) müsste 1:1 nachgebaut werden, ohne erkennbaren
Vorteil. **Empfehlung: Buchungen bleiben REST.**

## Empfehlung

**Hybrid statt Komplett-Tausch.**

1. **Lesen (Sync) → GraphQL.** Cursor-Pagination + gezielte Felder reduzieren
   Datenmenge und Roundtrips deutlich → löst Timeout-Risiko an der Wurzel.
   Eine einzige `issues`-Connection-Query liefert projektübergreifend genau die
   Felder, die `GitLabIssue` braucht (iid, projectId via `project { id }`, title,
   state, webUrl, updatedAt, timeEstimate/totalTimeSpent).
2. **Schreiben (Buchungen) → REST belassen.** Bewährt, idempotenz-gesichert,
   kein GraphQL-Mehrwert.

Komplett-Tausch wird **nicht** empfohlen: hoher Aufwand auf der Schreibseite bei
null funktionalem Gewinn.

## Umsetzungsplan (wenn Hybrid beschlossen)

### Phase A – GraphQL-Client-Grundlage
- [ ] `src/bun/gitlab/graphql.ts`: `gqlRequest(query, variables)` gegen
      `POST {gitlabUrl}/api/graphql` mit `Authorization: Bearer <token>`
      (GraphQL nutzt Bearer, **nicht** `PRIVATE-TOKEN`).
- [ ] URL-Validierung (`buildApiUrl`-Äquivalent) + Fehler-Mapping wiederverwenden.
- [ ] Rate-Limiter teilen (gleiche 5 req/s Instanz wie REST-Client).
- [ ] GraphQL-Fehler (`errors[]` im 200-Body!) auf `AppError` mappen — GraphQL
      liefert HTTP 200 auch bei Fehlern.

### Phase B – Sync auf GraphQL
- [ ] `fetchIssues(since?)` neu über `query { issues(...) }` mit
      Cursor-Pagination (`pageInfo.hasNextPage` / `endCursor`).
- [ ] Mapping GraphQL-Issue → bestehendes `GitLabIssue` (interne Form unverändert
      lassen, damit `sync.ts` unberührt bleibt).
- [ ] `updated_after` → GraphQL-Filter `updatedAfter`.
- [ ] `FakeGitLabClient` bleibt unverändert (Interface stabil).
- [ ] Tests: GraphQL-Response-Fixture → Mapping prüfen.

### Phase C – Aufräumen
- [ ] `fetch.ts` (REST-Lesen) entfernen oder als Fallback markieren.
- [ ] Skill `gitlab-integration` aktualisieren.

## Risiken / offene Fragen
- Self-hosted `gitlab.convotis-dev.com`: GraphQL-Schema-Version prüfen
  (welche Issue-Felder verfügbar?). Vor Phase B mit echtem Token verifizieren.
- Token-Scopes: GraphQL braucht `read_api`; Bearer-Header statt `PRIVATE-TOKEN`.
- Cursor-Pagination + `updatedAfter` Kombination auf der Zielinstanz testen.

## Entscheidung
> Hybrid (Sync=GraphQL, Buchung=REST) empfohlen. Vor Implementierung
> GraphQL-Verfügbarkeit auf der Self-hosted-Instanz verifizieren.
