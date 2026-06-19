-- Issue-Metadaten, die bisher nicht gesynct wurden (Beschreibung + Kopfdaten).
-- Alle Spalten nullable: GitLab liefert sie teils gar nicht (Autor/Milestone/
-- Fälligkeit können fehlen), und Bestandstickets haben sie noch nie gesehen.
ALTER TABLE tickets ADD COLUMN description TEXT;
ALTER TABLE tickets ADD COLUMN description_html TEXT;
ALTER TABLE tickets ADD COLUMN author_username TEXT;
ALTER TABLE tickets ADD COLUMN author_name TEXT;
ALTER TABLE tickets ADD COLUMN milestone_title TEXT;
ALTER TABLE tickets ADD COLUMN labels_json TEXT;
ALTER TABLE tickets ADD COLUMN due_date TEXT;
ALTER TABLE tickets ADD COLUMN issue_created_at TEXT;

-- Erzwingt einen Voll-Resync (90-Tage-Backfill), damit die neuen Metadaten-
-- Spalten auf bereits existierende Tickets nachgezogen werden. Der inkrementelle
-- Sync (updatedAfter = last_run) würde unveränderte Tickets nie erneut abrufen
-- und die neuen Spalten blieben für sie dauerhaft NULL. Bewusste, nicht-normale
-- Entscheidung gemäß Doku-Policy (vgl. Migration 013).
UPDATE schedules SET last_run = NULL WHERE name = 'gitlab_sync';
