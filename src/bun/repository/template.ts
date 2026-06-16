import type { Database } from "bun:sqlite";
import type { Template } from "../../shared/types";

interface TemplateRow {
  id: number;
  name: string;
  payload: string;
}

export function createTemplateRepository(db: Database) {
  return {
    list(): Template[] {
      return db.query<TemplateRow, []>("SELECT * FROM templates ORDER BY name").all();
    },

    create(input: Omit<Template, "id">): number {
      const row = db
        .query<{ id: number }, [string, string]>(
          "INSERT INTO templates (name, payload) VALUES (?, ?) RETURNING id",
        )
        .get(input.name, input.payload)!;
      return row.id;
    },

    update(template: Template): void {
      db.run("UPDATE templates SET name = ?, payload = ? WHERE id = ?", [
        template.name,
        template.payload,
        template.id,
      ]);
    },

    delete(id: number): void {
      db.run("DELETE FROM templates WHERE id = ?", [id]);
    },
  };
}

export type TemplateRepository = ReturnType<typeof createTemplateRepository>;
