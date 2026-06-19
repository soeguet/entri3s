ALTER TABLE ticket_comments ADD COLUMN discussion_id TEXT;
-- comments_hash wird einmalig genullt, damit der nächste On-Demand-/Hintergrund-
-- Kommentar-Sync ein Replace erzwingt und die discussion_id auf bereits gesyncte
-- Kommentare nachzieht. Ohne dies überspringt die Hash-Optimierung in comment.ts
-- unveränderte Tickets und discussion_id bliebe NULL. Bewusste, nicht-normale
-- Entscheidung (Doku-Policy: Workaround direkt an der Code-Stelle dokumentiert).
UPDATE tickets SET comments_hash = NULL;
