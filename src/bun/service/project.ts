import type { Project } from "../../shared/types";
import type { Repository } from "../repository";

export function createProjectService(repo: Repository) {
  return {
    getAll(): Project[] {
      return repo.projects.list();
    },
  };
}

export type ProjectService = ReturnType<typeof createProjectService>;
