-- Laufender Entry: höchstens einer gleichzeitig.
-- Partieller Unique-Index erzwingt die Invariante auf DB-Ebene; ein zweites
-- INSERT/UPDATE mit status='running' schlägt mit UNIQUE-Constraint fehl.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_running_entry
    ON entries (status) WHERE status = 'running';
