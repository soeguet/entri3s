-- Rückverfolgbarkeit pro Buchung: eine Zeile je erfolgreichem GitLab-/spend.
-- (Spec nennt 002_bookings.sql; 002 ist bereits seed_schedules, daher 003.)
CREATE TABLE IF NOT EXISTS bookings (
    id               INTEGER PRIMARY KEY,
    entry_id         INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    ticket_id        INTEGER NOT NULL REFERENCES tickets(id),
    gitlab_note_id   INTEGER NOT NULL,
    project_id       INTEGER NOT NULL,
    issue_iid        INTEGER NOT NULL,
    duration_minutes INTEGER NOT NULL,
    note             TEXT NOT NULL DEFAULT '',
    spent_at         TEXT NOT NULL,
    booked_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(gitlab_note_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_bookings_entry_id ON bookings(entry_id);
