import type { Tag } from "../../shared/types";
import type { Repository } from "../repository";

export function createTagService(repo: Repository) {
  return {
    getAll(): Tag[] {
      return repo.tags.list();
    },
    create(input: Omit<Tag, "id">): number {
      return repo.tags.create(input);
    },
    delete(id: number): void {
      repo.tags.delete(id);
    },
  };
}

export type TagService = ReturnType<typeof createTagService>;
