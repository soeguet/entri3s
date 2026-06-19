CREATE TABLE ticket_read_state (
    ticket_id          INTEGER PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
    last_viewed_at     DATETIME NOT NULL,
    last_comment_count INTEGER NOT NULL DEFAULT 0
);
