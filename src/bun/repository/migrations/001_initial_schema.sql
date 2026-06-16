CREATE TABLE IF NOT EXISTS entries (
    id          INTEGER PRIMARY KEY,
    title       TEXT NOT NULL,
    notes       TEXT,
    duration    INTEGER NOT NULL DEFAULT 0,
    date        DATETIME NOT NULL,
    status      TEXT NOT NULL DEFAULT 'draft',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tickets (
    id              INTEGER PRIMARY KEY,
    gitlab_iid      INTEGER NOT NULL,
    project_id      INTEGER NOT NULL,
    title           TEXT NOT NULL,
    state           TEXT NOT NULL DEFAULT 'opened',
    status          TEXT NOT NULL DEFAULT 'active',
    time_estimate   INTEGER,
    time_spent      INTEGER,
    web_url         TEXT,
    synced_at       DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(gitlab_iid, project_id)
);

CREATE TABLE IF NOT EXISTS entry_tickets (
    entry_id  INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    PRIMARY KEY (entry_id, ticket_id)
);

CREATE TABLE IF NOT EXISTS tags (
    id    INTEGER PRIMARY KEY,
    name  TEXT NOT NULL UNIQUE,
    color TEXT
);

CREATE TABLE IF NOT EXISTS entry_tags (
    entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (entry_id, tag_id)
);

CREATE TABLE IF NOT EXISTS templates (
    id      INTEGER PRIMARY KEY,
    name    TEXT NOT NULL UNIQUE,
    payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS event_queue (
    id           INTEGER PRIMARY KEY,
    type         TEXT NOT NULL,
    payload      TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',
    retries      INTEGER NOT NULL DEFAULT 0,
    error        TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME
);

CREATE TABLE IF NOT EXISTS schedules (
    id           INTEGER PRIMARY KEY,
    name         TEXT NOT NULL UNIQUE,
    interval_sec INTEGER NOT NULL,
    last_run     DATETIME,
    next_run     DATETIME,
    config       TEXT
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
