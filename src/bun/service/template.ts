import type { Template } from "../../shared/types";
import type { Repository } from "../repository";

export function createTemplateService(repo: Repository) {
  return {
    getAll(): Template[] {
      return repo.templates.list();
    },
    create(input: Omit<Template, "id">): number {
      return repo.templates.create(input);
    },
    update(template: Template): void {
      repo.templates.update(template);
    },
    delete(id: number): void {
      repo.templates.delete(id);
    },
  };
}

export type TemplateService = ReturnType<typeof createTemplateService>;
