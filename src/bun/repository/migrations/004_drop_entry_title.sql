-- Entry-Titel entfällt: notes ist das einzige Textfeld. Bestehende Daten sind
-- irrelevant. SQLite (3.35+) unterstützt DROP COLUMN nativ.
ALTER TABLE entries DROP COLUMN title;
