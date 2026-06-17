-- Booking v3: Buchungen laufen jetzt über GitLab-Timelogs (GraphQL timelogCreate)
-- statt über /spend-Kommentare. Die Rückreferenz ist daher eine Timelog-ID,
-- nicht mehr eine Note-ID. Spalte umbenennen (SQLite 3.25+ propagiert die
-- Umbenennung in den UNIQUE-Index).
ALTER TABLE bookings RENAME COLUMN gitlab_note_id TO gitlab_timelog_id;

-- Globale GitLab-Issue-ID auf dem Ticket: nötig, um die GraphQL-GID
-- (gid://gitlab/Issue/<id>) für timelogCreate zu bauen. Wird beim nächsten Sync
-- befüllt; bestehende Tickets haben bis dahin NULL.
ALTER TABLE tickets ADD COLUMN gitlab_global_id INTEGER;
