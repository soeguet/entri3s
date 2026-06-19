-- Einmaliger Backfill der Assignees auf bereits existierende Tickets.
-- Der Assignee-Sync (setAssignees -> ticket_assignees) wurde erst NACH dem
-- initialen 90-Tage-Backfill eingefuehrt, weshalb aeltere Tickets keine
-- Assignees haben. Durch das Nullen von last_run holt der naechste Sync alle
-- Tickets erneut (90-Tage-Backfill) und fuellt ticket_assignees nach.
UPDATE schedules SET last_run = NULL WHERE name = 'gitlab_sync';
