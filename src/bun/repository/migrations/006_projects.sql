-- Projekt-Metadaten aus dem GitLab-Sync. Der fullPath kodiert die komplette
-- Gruppen-/Namespace-Hierarchie (z.B. "acme/backend/api-service"); daraus leitet
-- das Frontend den Gruppenbaum ab. Bewusst KEIN Foreign Key auf tickets:
-- Tickets können vor ihrem Projekt gesynct werden, der Join passiert im UI.
CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY,   -- GitLab numerische Projekt-ID (= tickets.project_id)
    full_path   TEXT NOT NULL,         -- z.B. "acme/backend/api-service"
    name        TEXT NOT NULL,         -- Anzeigename des Projektblatts
    synced_at   DATETIME,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
