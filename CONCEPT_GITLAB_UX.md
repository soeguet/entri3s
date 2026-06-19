# Konzept: GitLab Issue-Assignment, Kommentare & Pinning UX

## Kontext

Die aktuelle GitLab-Integration in entries ist funktional, aber unübersichtlich wenn es
darum geht zu sehen, welche Issues einem zugewiesen sind, ob neue Kommentare existieren,
und ob man darauf reagieren muss. Dieses Konzept beschreibt die geplanten Verbesserungen.

## Ist-Zustand

- **Kein Assignee-Tracking**: Die App weiß nicht, wem ein GitLab-Issue zugewiesen ist.
  Gesynct werden nur: `title`, `state`, `timeEstimate`, `timeSpent`, `webUrl`.
- **Keine Kommentare**: Weder Sync noch Anzeige. Timelogs werden ohne Kommentar erstellt.
- **Kein Unread-Tracking**: Kein Mechanismus um zu erkennen, ob sich an einem Ticket
  etwas geändert hat seit dem letzten Besuch.
- **Sync-Infrastruktur**: Inkrementell alle 5 Min via GraphQL, Event-Queue für Writes,
  RPC-Bridge für Frontend-Notifications. Solide Basis zum Erweitern.
- **Ticket-Anzeige**: Hierarchischer Baum (Gruppe -> Projekt -> Ticket), Filter nach
  Status/State, Suchfeld.

## Diskussion & Entscheidungen

### Runde 1: Grundsatzfragen

**Frage: Assignee-Scope — nur "mir zugewiesen" oder auch Team-Überblick?**

Entscheidung: Alle Assignees syncen (alles wozu der API-Token berechtigt ist), aber im
Frontend einen Filter "Mir zugewiesen" anbieten. Zusätzlich soll der aktuelle GitLab-User
als ID persistiert werden, um den `currentUser`-API-Call nicht bei jedem Sync wiederholen
zu müssen.

**Frage: Kommentar-Tiefe — reicht ein Count + die letzten paar Kommentare, oder braucht
man den kompletten Thread?**

Entscheidung: Ein Counter alleine reicht nicht — damit gewinnt man nichts. Volle
Kommentare inklusive Attachments und System-Notes syncen. Die Vernetzung und der Verlauf
sind gerade das Interessante. Das ist ein größeres TODO und darf auch eines sein.

**Frage: System-Notes (automatische GitLab-Notizen wie Label-Changes, Assignee-Changes)
— mitsyncen oder filtern?**

Entscheidung: Mitsyncen. Wenn die Infos da sind, warum nicht.

**Frage: Sync-Frequenz für Kommentare — alle 5 Min mit dem Issue-Sync, oder seltener?**

Entscheidung: Konfigurierbar, aktueller 5-Min-Default für Issue-Sync passt. Kommentare
können ein eigenes, langsameres Intervall haben.

**Frage: Inbox als eigenständige Seite oder integriert in die bestehende Ticket-Seite?**

Entscheidung: Unter der aktuellen Ticket-Seite behalten. Intern State halten
(`last_viewed` / `last_updated`), damit man weiß was noch nicht gesichtet wurde.

**Frage: Schnell-Antwort-Textarea in der App oder Link zu GitLab?**

Entscheidung: Wenn es nicht einen Großteil dessen kann was GitLab anbietet, dann macht es
keinen Sinn es umzusetzen. Link zu GitLab reicht. Kein halbgares Markdown-Textarea.

**Neuer Wunsch: Ticket-Pinning**

Tickets persönlich pinnen/markieren für einen extra Modus/Filter/Ansicht. Rein lokaler
State, kein GitLab-Äquivalent.

### Runde 2: Detail-Entscheidungen

**Frage: Kommentar-Rendering — `bodyHtml` von GitLab (fertig gerendertes HTML) oder
`body` selbst mit Markdown-Renderer rendern?**

Entscheidung: `bodyHtml` von GitLab nehmen. XSS ist kein realistischer Angriffsvektor
bei einer lokalen Single-User-Desktop-App — der HTML-Content kommt vom eigenen
GitLab-Server. DOMPurify wäre overkill. Einzige Maßnahme: CSS-Scoping mit einem
`.gitlab-content`-Container, damit GitLab-Styles nicht das App-Layout brechen.

**Frage: Ticket-Detail als eigene Page oder Slide-in-Panel?**

Entscheidung: Darf eine eigene Seite/Route sein. Die genaue UI/UX-Gestaltung wird bei
der Implementierung entschieden.

**Frage: Sync-Volumen bei Kommentaren — Limit nötig?**

Entscheidung: Der Sync läuft im Hintergrund. Man kann mehr Luft zwischen den einzelnen
Tickets lassen. Sinnvoll ist eine Unterscheidung zwischen:
- Allgemeinem Issue-Sync (Metadaten, schnell, alle 5 Min)
- Kommentar-Sync für ein einzelnes Ticket (On-Demand beim Öffnen)
- Manueller Refresh-Button pro Ticket
- Hintergrund-Kommentar-Sync für gepinnte/zugewiesene Tickets (langsameres Intervall)

**Frage: Gepinnte Tickets exportierbar/importierbar?**

Entscheidung: Nein, lokale Persistierung in SQLite reicht. Kein Export nötig.

**Nachtrag: Read-State-Verhalten**

Tickets sollen NICHT automatisch als gelesen markiert werden nur weil man sie öffnet.
Stattdessen: expliziter "Als gelesen markieren"-Button. Man will ein Ticket oft nur kurz
ansehen ohne den Unread-Status zu verlieren.

## Technisches Konzept

### Dreistufige Sync-Architektur für Kommentare

| Sync-Typ                       | Trigger            | Was wird gesynct                                  | Frequenz                    |
| ------------------------------- | ------------------ | ------------------------------------------------- | --------------------------- |
| **Issue-Sync** (bestehend)      | Timer + manuell    | Ticket-Metadaten, Assignees, `userNotesCount`     | Alle 5 Min (konfigurierbar)|
| **Ticket-Detail-Sync**          | Ticket wird geöffnet / manueller Button | Alle Kommentare für ein Ticket | On-Demand          |
| **Hintergrund-Kommentar-Sync**  | Timer              | Kommentare für gepinnte + zugewiesene Tickets     | Eigenes Intervall, z.B. 15 Min |

Der reguläre 5-Min-Sync wird nicht schwerer — er holt nur `userNotesCount` als
zusätzliches Integer-Feld, keinen Kommentar-Content.

### Attachment-Handling

Inline-Attachments (Bilder in Kommentaren) werden via `bodyHtml` als `<img src="...">`
gerendert. Die URLs zeigen auf GitLab-Uploads und brauchen Authentifizierung.

Für v1: Bilder als Links darstellen ("Anhang anzeigen" -> öffnet im Browser). Ein
Bun-seitiger Proxy der die Bilder mit Token fetcht und lokal bereitstellt kann später
nachgerüstet werden.

### Rate-Limiting-Überlegung

Der bestehende 5 req/s Limiter ist shared. Bei 20 gepinnten Tickets, jedes mit eigenem
GraphQL-Call, dauert der Hintergrund-Sync ~4 Sekunden. Vertretbar. Bei 100+ gepinnten
Tickets müsste man ggf. batchen — aber das ist kein realistisches Szenario.

## TODOs (Implementierungsreihenfolge)

### TODO 1: Current User persistieren (Fundament)

**Warum zuerst:** Assignee-Filter, Unread-Tracking und alles Weitere braucht die
User-ID als Referenzpunkt.

**Umsetzung:**
- Beim ersten erfolgreichen Sync (oder Token-Änderung): GraphQL-Query
  `currentUser { id username name }` ausführen
- In `settings`-Table persistieren: `gitlab_user_id`, `gitlab_username`
  (key-value wie `gitlabUrl`)
- Einmalig + bei Token-Änderung refreshen — kein Overhead pro Sync-Cycle
- Neuer RPC: `getCurrentUser`

### TODO 2: Assignee-Sync + Filter

**GraphQL-Änderung** in `graphql.ts`:
- `GqlIssueNode` erweitern: `assignees { nodes { id username name } }`
- `GitLabIssue` erweitern um `assignees: Array<{ id: number; username: string; name: string }>`

**Schema:**
```sql
CREATE TABLE ticket_assignees (
    ticket_id       INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    gitlab_user_id  INTEGER NOT NULL,
    username        TEXT NOT NULL,
    name            TEXT NOT NULL,
    PRIMARY KEY (ticket_id, gitlab_user_id)
);
```

Kein separates `users`-Table — Assignee-Daten denormalisiert pro Ticket (weniger Joins,
simplere Sync-Logik).

**Sync:** Nach `tickets.upsert()`: bestehende Assignees für das Ticket löschen, neue
einfügen (Replace-Strategie, da GitLab die vollständige Liste liefert).

**Types:**
```typescript
interface TicketAssignee {
  gitlabUserId: number;
  username: string;
  name: string;
}

// Ticket erweitern:
interface Ticket {
  // ... bestehende Felder ...
  assignees: TicketAssignee[];
}

// Filter erweitern:
interface TicketFilter {
  status?: TicketStatus;
  state?: TicketState;
  assignedToMe?: boolean;
}
```

**Frontend:** Filter-Chip "Mir zugewiesen" (Toggle), Assignee-Anzeige in der
Ticket-Tabelle.

### TODO 3: Ticket-Pinning

**Schema:**
```sql
CREATE TABLE ticket_pins (
    ticket_id  INTEGER PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
    pinned_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Rein lokaler State, kein GitLab-Äquivalent. Persistiert in SQLite, kein Export nötig.

**RPCs:** `pinTicket(ticketId)`, `unpinTicket(ticketId)`

**Frontend:**
- Pin-Toggle in der Ticket-Zeile
- Filter "Gepinnt" in der Ticket-Seite
- TicketPicker: Sektion "Gepinnt" vor "Zuletzt verwendet"
- Gepinnte Tickets immer oben innerhalb ihrer Projektgruppe

### TODO 4: Kommentar-Count im Issue-Sync

**GraphQL:** `userNotesCount` im Issue-Query mitzählen (1 Integer, kein Overhead).

**Schema:** Neue Spalte `notes_count INTEGER DEFAULT 0` in `tickets`.

**Sync:** Count bei jedem Upsert aktualisieren.

### TODO 5: Unread-Tracking

**Schema:**
```sql
CREATE TABLE ticket_read_state (
    ticket_id          INTEGER PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
    last_viewed_at     DATETIME NOT NULL,
    last_comment_count INTEGER NOT NULL DEFAULT 0
);
```

**Logik:**
- `notes_count > last_comment_count` -> Ticket hat ungelesene Kommentare
- Kein Eintrag in `ticket_read_state` -> implizit "ungelesen" (für neue Tickets)
- Ticket öffnen markiert NICHT automatisch als gelesen
- Expliziter "Als gelesen markieren"-Button setzt `last_viewed_at = NOW()` und
  `last_comment_count = aktueller notes_count`
- Zusätzlich: "Alle als gelesen markieren" auf der Ticket-Seite

**RPC:** `markTicketRead(ticketId)` — expliziter Call

**Frontend:** Unread-Badge/Dot in der Ticket-Liste, "Als gelesen markieren"-Button in
Detail-Ansicht, Filter-Option "Ungelesen".

### TODO 6: Voller Kommentar-Sync

**Schema:**
```sql
CREATE TABLE ticket_comments (
    id              INTEGER PRIMARY KEY,
    ticket_id       INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    gitlab_note_id  INTEGER NOT NULL UNIQUE,
    author_username TEXT NOT NULL,
    author_name     TEXT NOT NULL,
    body            TEXT NOT NULL,
    body_html       TEXT NOT NULL,
    is_system       INTEGER NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL,
    updated_at      DATETIME NOT NULL,
    synced_at       DATETIME NOT NULL
);
CREATE INDEX idx_ticket_comments_ticket ON ticket_comments(ticket_id);
```

`body` (Markdown) für Suche, `bodyHtml` (gerendertes HTML von GitLab) für Anzeige.

**GraphQL:**
```graphql
notes(first: 100, after: $notesAfter) {
  nodes {
    id
    body
    bodyHtml
    system
    author { id username name }
    createdAt
    updatedAt
  }
  pageInfo { hasNextPage endCursor }
}
```

**Drei Sync-Pfade:**
1. **On-Demand:** `syncTicketComments(ticketId)` beim Ticket-Öffnen + manueller Button
2. **Hintergrund:** Neuer Schedule `comment_sync` (15 Min Default) für gepinnte +
   zugewiesene Tickets
3. **Regulärer Issue-Sync** bleibt unverändert (nur `userNotesCount`)

Inkrementell: `updatedAfter` auf dem Notes-Query, nur neue/geänderte Kommentare
nachziehen.

### TODO 7: Ticket-Detail-Ansicht (Frontend)

Eigene Page/Route für Ticket-Details. Bündelt alles aus TODO 1-6:

- Kommentar-Thread: `bodyHtml` rendern mit CSS-Scoping (`.gitlab-content`-Container)
- System-Notes visuell abgesetzt (Timeline-Style, grau, kompakter)
- Assignee-Anzeige
- Pin-Toggle
- "Als gelesen markieren"-Button
- "Kommentare aktualisieren"-Button (ruft `syncTicketComments` auf)
- "In GitLab öffnen"-Link prominent

## Abhängigkeiten

```
TODO 1 (Current User)
  |
  v
TODO 2 (Assignees) <-- braucht User-ID für "Mir zugewiesen"

TODO 3 (Pinning) <-- unabhängig, kann parallel zu 1+2

TODO 4 (Comment Count) <-- unabhängig von 1-3
  |
  v
TODO 5 (Unread) <-- braucht Count aus TODO 4
  |
  v
TODO 6 (Kommentar-Sync) <-- braucht Unread für Badge-Logik, Pinning für Hintergrund-Sync
  |
  v
TODO 7 (Detail-Ansicht) <-- braucht Kommentare, Assignees, Pinning, Unread
```

**Parallele Streams:**
- Stream A: TODO 1 -> TODO 2
- Stream B: TODO 3 (parallel zu Stream A)
- Stream C: TODO 4 -> TODO 5 -> TODO 6 -> TODO 7

TODO 7 ist der Integrations-TODO, der alles zusammenführt.

## Bewusst nicht umgesetzt

- **Rich-Markdown-Editor / Inline-Kommentieren**: Wenn es nicht den Großteil dessen kann
  was GitLab anbietet, bringt es keinen Mehrwert. Link zu GitLab reicht.
- **Attachment-Upload**: Zu viel Aufwand, GitLab kann das besser.
- **Export von Pins**: Nicht nötig, lokale Persistierung reicht.

## Mögliche spätere Erweiterungen (nicht Teil dieses Konzepts)

- Attachment-Proxy (Bilder inline statt Link)
- Label-Sync + Label-Filter
- Due-Date-Anzeige
- Meilenstein-Gruppierung
- Desktop-Notifications bei neuen Kommentaren auf zugewiesenen/gepinnten Tickets
- Schnell-Actions (Issue schließen, sich selbst zuweisen) — nur wenn Kommentar-Write steht
