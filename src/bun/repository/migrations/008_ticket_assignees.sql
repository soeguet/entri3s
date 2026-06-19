CREATE TABLE ticket_assignees (
    ticket_id       INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    gitlab_user_id  INTEGER NOT NULL,
    username        TEXT NOT NULL,
    name            TEXT NOT NULL,
    PRIMARY KEY (ticket_id, gitlab_user_id)
);
