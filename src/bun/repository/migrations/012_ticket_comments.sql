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
ALTER TABLE tickets ADD COLUMN comments_hash TEXT;
INSERT INTO schedules (name, interval_sec) VALUES ('comment_sync', 900);
