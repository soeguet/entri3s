import type { Repository } from "../repository";
import type { GitLabClient } from "../gitlab/types";
import type { Commit, Project } from "../../shared/types";
import { createLogger } from "../lib/logger";

const log = createLogger("commit");

export function createCommitService(repo: Repository, gl: GitLabClient) {
  return {
    async getForDate(date: string): Promise<Commit[]> {
      const since = `${date}T00:00:00Z`;
      const until = `${date}T23:59:59Z`;
      const projects = repo.projects.list();

      const results = await Promise.allSettled(
        projects.map((p: Project) => gl.fetchCommits(p.id, since, until)),
      );

      const commits: Commit[] = [];
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled") {
          for (const c of result.value) {
            commits.push({
              hash: c.id,
              shortHash: c.short_id,
              title: c.title,
              authorName: c.author_name,
              createdAt: c.created_at,
              webUrl: c.web_url,
              projectId: projects[i].id,
            });
          }
        } else {
          log.warn(`Commits für Projekt ${projects[i].id} fehlgeschlagen`, {
            error: String(result.reason),
          });
        }
      }

      commits.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return commits;
    },
  };
}
