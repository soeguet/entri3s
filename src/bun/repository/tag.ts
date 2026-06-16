import type { Database } from "bun:sqlite";
import type { Tag } from "../../shared/types";

interface TagRow {
  id: number;
  name: string;
  color: string | null;
}

export function createTagRepository(db: Database) {
  return {
    list(): Tag[] {
      return db.query<TagRow, []>("SELECT * FROM tags ORDER BY name").all();
    },

    create(input: Omit<Tag, "id">): number {
      const row = db
        .query<{ id: number }, [string, string | null]>(
          "INSERT INTO tags (name, color) VALUES (?, ?) RETURNING id",
        )
        .get(input.name, input.color)!;
      return row.id;
    },

    delete(id: number): void {
      db.run("DELETE FROM tags WHERE id = ?", [id]);
    },
  };
}

export type TagRepository = ReturnType<typeof createTagRepository>;
