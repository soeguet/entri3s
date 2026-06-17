import type { Database } from "bun:sqlite";
import type { Project } from "../../shared/types";

interface ProjectRow {
  id: number;
  full_path: string;
  name: string;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectUpsert {
  id: number;
  fullPath: string;
  name: string;
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    fullPath: row.full_path,
    name: row.name,
    syncedAt: row.synced_at,
  };
}

export function createProjectRepository(db: Database) {
  return {
    list(): Project[] {
      return db
        .query<ProjectRow, []>("SELECT * FROM projects ORDER BY full_path")
        .all()
        .map(toProject);
    },

    getById(id: number): Project | null {
      const row = db.query<ProjectRow, [number]>("SELECT * FROM projects WHERE id = ?").get(id);
      return row ? toProject(row) : null;
    },

    upsert(input: ProjectUpsert): void {
      const now = new Date().toISOString();
      db.run(
        `INSERT INTO projects (id, full_path, name, synced_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           full_path = excluded.full_path,
           name = excluded.name,
           synced_at = excluded.synced_at,
           updated_at = excluded.updated_at`,
        [input.id, input.fullPath, input.name, now, now, now],
      );
    },
  };
}

export type ProjectRepository = ReturnType<typeof createProjectRepository>;
